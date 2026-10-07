import { useInkUI } from '@app/components/providers/InkUIProvider';
import { authClient } from '@app/lib/auth/client';
import type {
  AdminAccountBanDuration,
  AdminAccountChangeEmailResponse,
  AdminAccountErrorResponse,
  AdminAccountListItem,
  AdminAccountListResponse,
  AdminAccountModerationResponse,
  AdminAccountRevokeSessionsResponse,
} from '@shared/contracts/adminAccounts';
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from 'react';
import { useBlocker } from 'react-router';
import { AdminDrawer } from '../_components/AdminDrawer';
import './accounts.css';

const PAGE_SIZE = 20;
const PROVIDER_LABELS: Record<string, string> = {
  credential: '邮箱密码',
  github: 'GitHub',
};
const TABS = [
  { id: 'profile', label: '基本资料' },
  { id: 'character', label: '当前角色' },
  { id: 'sessions', label: '登录会话' },
] as const;
type DetailTab = (typeof TABS)[number]['id'];
type AccountAction = 'email' | 'ban' | 'unban' | 'revoke';
type Notice = { message: string; tone: 'danger' | 'success'; status?: number };

function formatDateTime(value: string | null): string {
  if (!value) return '暂无';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '暂无' : date.toLocaleString('zh-CN');
}

function accountStatus(account: AdminAccountListItem) {
  if (!account.banned) return { label: '正常', tone: 'green' };
  if (
    account.banExpires &&
    new Date(account.banExpires).getTime() <= Date.now()
  ) {
    return { label: '封禁已过期', tone: 'muted' };
  }
  return { label: '已封禁', tone: 'danger' };
}

function AccountStatus({ account }: { account: AdminAccountListItem }) {
  const status = accountStatus(account);
  return (
    <span className={`account-badge account-badge--${status.tone}`}>
      {status.label}
    </span>
  );
}

async function readPayload<T>(response: Response): Promise<T> {
  return (await response.json().catch(() => ({
    success: false,
    error: '服务器返回了无法解析的响应，请稍后重试',
  }))) as T;
}

function responseMessage(response: Response, message: string) {
  if (response.status === 401) return '登录已过期，请重新登录后继续。';
  if (response.status === 403)
    return '当前账号没有账号管理权限，请联系管理员。';
  if (response.status >= 500) return '服务暂时不可用，请稍后重试。';
  return message;
}

export default function AdminAccountsPage() {
  const { pushToast } = useInkUI();
  const sessionState = authClient.useSession();
  const operatorUserId = sessionState.data?.user.id;
  const [accounts, setAccounts] = useState<AdminAccountListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [searchDraft, setSearchDraft] = useState('');
  const [search, setSearch] = useState('');
  const [searchField, setSearchField] = useState<'email' | 'name'>('email');
  const [verified, setVerified] = useState<'all' | 'true' | 'false'>('all');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<Notice | null>(null);
  const [offline, setOffline] = useState(() => !navigator.onLine);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [selectedAccount, setSelectedAccount] =
    useState<AdminAccountListItem | null>(null);
  const [activeTab, setActiveTab] = useState<DetailTab>('profile');
  const [action, setAction] = useState<AccountAction | null>(null);
  const [moreOpen, setMoreOpen] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [confirmEmail, setConfirmEmail] = useState('');
  const [banReason, setBanReason] = useState('');
  const [banDuration, setBanDuration] =
    useState<AdminAccountBanDuration>('7_days');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [pendingExit, setPendingExit] = useState<'drawer' | 'form' | null>(
    null,
  );
  const [sessionRevokePending, setSessionRevokePending] = useState<Set<string>>(
    new Set(),
  );
  const mutationInFlight = useRef(false);
  const accessRevision = useRef(0);
  const allowNavigation = useRef(false);
  const actionHeading = useRef<HTMLHeadingElement>(null);
  const isDirty =
    (action === 'email' && Boolean(newEmail || confirmEmail)) ||
    (action === 'ban' && Boolean(banReason || banDuration !== '7_days'));
  const blocker = useBlocker(
    () => !allowNavigation.current && (isDirty || busy),
  );
  const exitRequested = pendingExit !== null || blocker.state === 'blocked';
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const accessDenied =
    loadError?.status === 401 ||
    loadError?.status === 403 ||
    notice?.status === 401 ||
    notice?.status === 403;
  const mutationDisabled = busy || offline || accessDenied;

  const clearPrivateData = useCallback(() => {
    accessRevision.current += 1;
    setAccounts([]);
    setTotal(0);
    setHasLoaded(false);
    setLoading(false);
    setSelectedAccount(null);
    setAction(null);
    setMoreOpen(false);
    setNewEmail('');
    setConfirmEmail('');
    setBanReason('');
    setBanDuration('7_days');
    setPendingExit(null);
    setNotice(null);
    setSessionRevokePending(new Set());
  }, []);

  const loadAccounts = useCallback(
    async (signal: AbortSignal) => {
      if (signal.aborted) return;
      const requestAccessRevision = accessRevision.current;
      setLoading(true);
      setLoadError(null);
      const request = new AbortController();
      let timedOut = false;
      const abort = () => request.abort();
      signal.addEventListener('abort', abort, { once: true });
      const timeout = window.setTimeout(() => {
        timedOut = true;
        request.abort();
      }, 15000);
      try {
        const query = new URLSearchParams({
          page: String(page),
          limit: String(PAGE_SIZE),
          searchField,
          verified,
        });
        if (search) query.set('search', search);
        const response = await fetch(`/api/admin/accounts?${query}`, {
          cache: 'no-store',
          credentials: 'include',
          signal: request.signal,
        });
        const payload = await readPayload<
          AdminAccountListResponse | AdminAccountErrorResponse
        >(response);
        if (signal.aborted || requestAccessRevision !== accessRevision.current)
          return;
        if (!payload.success || !response.ok) {
          if (response.status === 401 || response.status === 403)
            clearPrivateData();
          setLoadError({
            message: responseMessage(
              response,
              !payload.success ? payload.error : '加载账号列表失败',
            ),
            tone: 'danger',
            status: response.status,
          });
          return;
        }
        const nextTotalPages = Math.max(
          1,
          Math.ceil(payload.data.total / PAGE_SIZE),
        );
        if (page > nextTotalPages) {
          setPage(nextTotalPages);
          return;
        }
        setAccounts(payload.data.accounts);
        setTotal(payload.data.total);
        setHasLoaded(true);
        setSelectedAccount((current) =>
          current
            ? (payload.data.accounts.find(
                (account) => account.userId === current.userId,
              ) ?? current)
            : null,
        );
      } catch {
        if (signal.aborted || requestAccessRevision !== accessRevision.current)
          return;
        setLoadError({
          message: !navigator.onLine
            ? '网络已断开，恢复连接后会重新加载。'
            : timedOut
              ? '加载超时，请重试。'
              : '无法加载账号列表，请检查网络后重试。',
          tone: 'danger',
        });
      } finally {
        window.clearTimeout(timeout);
        signal.removeEventListener('abort', abort);
        if (!signal.aborted && requestAccessRevision === accessRevision.current)
          setLoading(false);
      }
    },
    [clearPrivateData, page, search, searchField, verified],
  );

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(
      () => void loadAccounts(controller.signal),
      0,
    );
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [loadAccounts, refreshKey]);

  useEffect(() => {
    const onOnline = () => {
      setOffline(false);
      setRefreshKey((value) => value + 1);
    };
    const onOffline = () => setOffline(true);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  useEffect(() => {
    if (!isDirty && !busy) return;
    const preventLeaving = (event: BeforeUnloadEvent) => {
      if (allowNavigation.current) return;
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', preventLeaving);
    return () => window.removeEventListener('beforeunload', preventLeaving);
  }, [isDirty, busy]);

  useEffect(() => {
    if (action || exitRequested || moreOpen) actionHeading.current?.focus();
  }, [action, exitRequested, moreOpen]);

  useEffect(() => {
    if (accessDenied && blocker.state === 'blocked') blocker.reset();
  }, [accessDenied, blocker]);

  const focusDetailTab = () => {
    window.requestAnimationFrame(() =>
      document.getElementById(`account-tab-${activeTab}`)?.focus(),
    );
  };
  const resetForm = () => {
    setAction(null);
    setMoreOpen(false);
    setNewEmail('');
    setConfirmEmail('');
    setBanReason('');
    setBanDuration('7_days');
  };
  const closeDetails = () => {
    resetForm();
    setPendingExit(null);
    setNotice(null);
    setSelectedAccount(null);
  };
  const cancelExit = () => {
    setPendingExit(null);
    if (blocker.state === 'blocked') blocker.reset();
  };
  const requestClose = () => {
    if (busy) return;
    if (exitRequested) {
      cancelExit();
      return;
    }
    if (isDirty) setPendingExit('drawer');
    else closeDetails();
  };
  const discardChanges = () => {
    if (busy) return;
    if (blocker.state === 'blocked') {
      blocker.proceed();
      return;
    }
    if (pendingExit === 'drawer') closeDetails();
    else {
      resetForm();
      setPendingExit(null);
      focusDetailTab();
    }
  };
  const cancelAction = () => {
    if (busy) return;
    if (isDirty) setPendingExit('form');
    else {
      resetForm();
      focusDetailTab();
    }
  };
  const openDetails = (account: AdminAccountListItem) => {
    setSelectedAccount(account);
    setActiveTab('profile');
    setNotice(null);
    setPendingExit(null);
    resetForm();
  };
  const beginAction = (nextAction: AccountAction) => {
    if (mutationDisabled) return;
    setNotice(null);
    setMoreOpen(false);
    setAction(nextAction);
  };
  const updateAccount = (
    userId: string,
    patch: Partial<AdminAccountListItem>,
  ) => {
    setAccounts((current) =>
      current.map((account) =>
        account.userId === userId ? { ...account, ...patch } : account,
      ),
    );
    setSelectedAccount((current) =>
      current?.userId === userId ? { ...current, ...patch } : current,
    );
  };
  const markSessionRevoke = (userId: string, pending: boolean) => {
    setSessionRevokePending((current) => {
      const next = new Set(current);
      if (pending) next.add(userId);
      else next.delete(userId);
      return next;
    });
  };
  const reportNotice = (
    message: string,
    tone: Notice['tone'],
    status?: number,
  ) => {
    setNotice({ message, tone, status });
    pushToast({ message, tone, duration: 6000 });
  };
  const submitSearch = (event: FormEvent) => {
    event.preventDefault();
    const next = searchDraft.trim();
    const unchanged = page === 1 && next === search;
    setPage(1);
    setSearch(next);
    if (unchanged) setRefreshKey((value) => value + 1);
  };
  const resetFilters = () => {
    setPage(1);
    setSearch('');
    setSearchDraft('');
    setSearchField('email');
    setVerified('all');
  };

  const submitAction = async (event: FormEvent) => {
    event.preventDefault();
    if (
      !selectedAccount ||
      !action ||
      mutationDisabled ||
      mutationInFlight.current
    )
      return;
    const account = selectedAccount;
    const normalizedEmail = newEmail.trim().toLowerCase();
    if (action === 'email') {
      if (!normalizedEmail || !confirmEmail.trim()) {
        reportNotice('请填写并确认新邮箱', 'danger');
        return;
      }
      if (normalizedEmail !== confirmEmail.trim().toLowerCase()) {
        reportNotice('两次输入的新邮箱不一致', 'danger');
        return;
      }
      if (normalizedEmail === account.email.toLowerCase()) {
        reportNotice('新邮箱不能与当前邮箱相同', 'danger');
        return;
      }
    }
    if (
      action === 'ban' &&
      (!banReason.trim() || account.userId === operatorUserId)
    ) {
      reportNotice(
        account.userId === operatorUserId
          ? '不能封禁当前管理员账号'
          : '请填写封禁原因',
        'danger',
      );
      return;
    }
    const endpoint = {
      email: 'change-email',
      ban: 'ban',
      unban: 'unban',
      revoke: 'revoke-sessions',
    }[action];
    const body =
      action === 'email'
        ? { expectedCurrentEmail: account.email, newEmail: normalizedEmail }
        : action === 'ban'
          ? { reason: banReason.trim(), duration: banDuration }
          : undefined;
    const requestAccessRevision = accessRevision.current;
    mutationInFlight.current = true;
    setBusy(true);
    setNotice(null);
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 30000);
    try {
      const response = await fetch(
        `/api/admin/accounts/${account.userId}/${endpoint}`,
        {
          method: 'POST',
          credentials: 'include',
          signal: controller.signal,
          ...(body
            ? {
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
              }
            : {}),
        },
      );
      const payload = await readPayload<
        | AdminAccountChangeEmailResponse
        | AdminAccountRevokeSessionsResponse
        | AdminAccountModerationResponse
        | AdminAccountErrorResponse
      >(response);
      if (requestAccessRevision !== accessRevision.current) return;
      if (!payload.success || !response.ok) {
        if (response.status === 401 || response.status === 403) {
          const message = responseMessage(response, '账号操作权限已失效');
          clearPrivateData();
          setLoadError({ message, tone: 'danger', status: response.status });
          pushToast({ message, tone: 'danger', duration: 6000 });
          return;
        }
        if (
          !payload.success &&
          payload.code === 'EMAIL_CHANGED_SESSION_REVOKE_FAILED' &&
          payload.partial
        ) {
          updateAccount(payload.partial.userId, {
            email: payload.partial.email,
            emailVerified: false,
          });
          markSessionRevoke(payload.partial.userId, true);
          resetForm();
          focusDetailTab();
          setRefreshKey((value) => value + 1);
          reportNotice(
            '邮箱已修改，但会话未全部撤销。请点击“重试下线”完成处理。',
            'danger',
          );
          return;
        }
        reportNotice(
          responseMessage(
            response,
            !payload.success ? payload.error : '操作失败，请稍后重试',
          ),
          'danger',
          response.status,
        );
        return;
      }
      const data = payload.data;
      if ('email' in data) {
        updateAccount(data.userId, {
          email: data.email,
          emailVerified: false,
          activeSessionCount: 0,
        });
      } else if ('banned' in data) {
        updateAccount(data.userId, {
          banned: data.banned,
          banReason: data.banReason,
          banExpires: data.banExpires,
          ...(data.sessionsRevoked ? { activeSessionCount: 0 } : {}),
        });
      } else {
        updateAccount(data.userId, { activeSessionCount: 0 });
      }
      if (action !== 'unban')
        markSessionRevoke(data.userId, !data.sessionsRevoked);
      resetForm();
      focusDetailTab();
      reportNotice(
        {
          email: '邮箱已改绑为未验证状态，现有会话已全部撤销。',
          ban: data.sessionsRevoked
            ? '账号已封禁，现有会话已全部撤销。'
            : '账号已封禁，请重试撤销登录会话。',
          unban: '账号封禁已解除，玩家可以重新登录。',
          revoke: '账号会话已全部撤销，玩家需要重新登录。',
        }[action],
        action === 'ban' && !data.sessionsRevoked ? 'danger' : 'success',
      );
      if (
        operatorUserId === data.userId &&
        (action === 'email' || action === 'revoke')
      ) {
        allowNavigation.current = true;
        window.location.assign('/login');
        return;
      }
      setRefreshKey((value) => value + 1);
    } catch {
      if (requestAccessRevision !== accessRevision.current) return;
      reportNotice(
        controller.signal.aborted
          ? '请求超时，操作可能已执行。请刷新列表确认当前状态后再试。'
          : '网络请求未完成，操作结果暂时未知。请恢复连接并刷新列表后确认。',
        'danger',
      );
      setRefreshKey((value) => value + 1);
    } finally {
      window.clearTimeout(timeout);
      mutationInFlight.current = false;
      setBusy(false);
    }
  };

  const moveTab = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    let next: number;
    if (event.key === 'ArrowRight') next = (index + 1) % TABS.length;
    else if (event.key === 'ArrowLeft')
      next = (index + TABS.length - 1) % TABS.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = TABS.length - 1;
    else return;
    event.preventDefault();
    setActiveTab(TABS[next].id);
    document.getElementById(`account-tab-${TABS[next].id}`)?.focus();
  };

  const actionTitle =
    action === 'email'
      ? '改绑登录邮箱'
      : action === 'ban'
        ? '封禁账号'
        : action === 'unban'
          ? '确认解除封禁'
          : '确认强制下线';
  const actionLabel = busy
    ? '正在处理…'
    : action === 'email'
      ? '确认改绑并下线'
      : action === 'ban'
        ? '确认封禁并下线'
        : action === 'unban'
          ? '确认解封'
          : '确认下线';

  return (
    <div className="accounts-page">
      <header className="admin-page-heading accounts-heading">
        <div>
          <h2>账号管理</h2>
          <p>查找玩家账号，按需查看资料与处理账号事务。</p>
        </div>
        <button
          className="admin-btn"
          type="button"
          onClick={() => setRefreshKey((value) => value + 1)}
          disabled={loading || offline}
          aria-label="刷新账号列表"
        >
          {loading && hasLoaded ? '刷新中…' : '刷新列表'}
        </button>
      </header>

      {offline && (
        <div className="accounts-notice accounts-notice--danger" role="status">
          网络已断开，账号操作暂不可用。恢复连接后会自动重新加载。
        </div>
      )}

      <section className="admin-panel accounts-panel" aria-label="账号列表">
        <form className="accounts-search" onSubmit={submitSearch}>
          <label className="accounts-search-input">
            <span className="admin-label">
              {searchField === 'email' ? '搜索登录邮箱' : '搜索账号昵称'}
            </span>
            <input
              className="admin-field"
              type="search"
              value={searchDraft}
              maxLength={200}
              placeholder={
                searchField === 'email' ? '输入邮箱关键字' : '输入账号昵称'
              }
              onChange={(event) => setSearchDraft(event.target.value)}
            />
          </label>
          <button
            className="admin-btn admin-btn-primary"
            type="submit"
            disabled={loading || offline}
          >
            搜索
          </button>
          <button
            className={`admin-btn${filtersOpen ? 'accounts-filter-active' : ''}`}
            type="button"
            aria-expanded={filtersOpen}
            aria-controls="account-advanced-filters"
            onClick={() => setFiltersOpen((value) => !value)}
          >
            筛选
            {verified !== 'all' || searchField !== 'email' ? ' · 已设置' : ''}
          </button>
          {filtersOpen && (
            <div className="accounts-filters" id="account-advanced-filters">
              <label>
                <span className="admin-label">搜索字段</span>
                <select
                  className="admin-field"
                  value={searchField}
                  onChange={(event) => {
                    setSearchField(event.target.value as 'email' | 'name');
                    setPage(1);
                  }}
                >
                  <option value="email">登录邮箱</option>
                  <option value="name">账号昵称</option>
                </select>
              </label>
              <label>
                <span className="admin-label">邮箱验证状态</span>
                <select
                  className="admin-field"
                  value={verified}
                  onChange={(event) => {
                    setVerified(event.target.value as 'all' | 'true' | 'false');
                    setPage(1);
                  }}
                >
                  <option value="all">全部验证状态</option>
                  <option value="true">已验证</option>
                  <option value="false">未验证</option>
                </select>
              </label>
              <button
                className="admin-btn admin-btn-quiet"
                type="button"
                onClick={resetFilters}
              >
                重置筛选
              </button>
            </div>
          )}
        </form>
        <div className="accounts-list-caption">
          <h3>
            账号列表{' '}
            <span>
              {hasLoaded ? `${total} 个` : loading ? '正在加载' : '未加载'}
            </span>
          </h3>
          {(search || verified !== 'all') && (
            <button
              className="admin-btn admin-btn-quiet"
              type="button"
              onClick={resetFilters}
            >
              清除条件
            </button>
          )}
        </div>
        {loadError && (
          <div className="accounts-notice accounts-notice--danger" role="alert">
            <p>
              {loadError.message}
              {!accessDenied && hasLoaded && accounts.length > 0
                ? ' 以下为上次加载的结果。'
                : ''}
            </p>
            <div className="accounts-notice-actions">
              {loadError.status === 401 ? (
                <a className="admin-btn" href="/login">
                  重新登录
                </a>
              ) : (
                <button
                  className="admin-btn"
                  type="button"
                  disabled={loading || offline}
                  onClick={() => setRefreshKey((value) => value + 1)}
                >
                  重新加载
                </button>
              )}
            </div>
          </div>
        )}
        <div aria-busy={loading}>
          {loading && !hasLoaded ? (
            <div className="admin-empty" role="status">
              正在加载账号…
            </div>
          ) : accounts.length === 0 ? (
            !loadError && (
              <div className="admin-empty">
                <strong>
                  {search || verified !== 'all'
                    ? '没有找到符合条件的账号'
                    : '暂无账号'}
                </strong>
                <p>
                  {search || verified !== 'all'
                    ? '试试其他邮箱或昵称，或者清除筛选条件。'
                    : '玩家注册后会显示在这里。'}
                </p>
                {(search || verified !== 'all') && (
                  <button
                    className="admin-btn"
                    type="button"
                    onClick={resetFilters}
                  >
                    清除筛选
                  </button>
                )}
              </div>
            )
          ) : (
            <>
              <table className="accounts-table">
                <caption className="accounts-sr-only">
                  玩家账号与当前角色列表
                </caption>
                <thead>
                  <tr>
                    <th scope="col">账号</th>
                    <th scope="col">当前角色</th>
                    <th scope="col">状态</th>
                    <th scope="col">注册时间</th>
                    <th scope="col">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {accounts.map((account) => (
                    <tr key={account.userId}>
                      <td>
                        <div className="account-identity">
                          <span className="account-avatar" aria-hidden="true">
                            {account.name.slice(0, 1) || '道'}
                          </span>
                          <div>
                            <strong>
                              {account.name || '未设置昵称'}
                              {account.userId === operatorUserId && (
                                <small className="account-self">本人</small>
                              )}
                            </strong>
                            <span className="account-secondary account-email">
                              {account.email}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td>
                        {account.activeCultivator ? (
                          <>
                            <strong className="account-character-name">
                              {account.activeCultivator.name}
                            </strong>
                            <span className="account-secondary">
                              {account.activeCultivator.realm}
                              {account.activeCultivator.realmStage}
                            </span>
                          </>
                        ) : (
                          <span className="account-secondary">尚无角色</span>
                        )}
                      </td>
                      <td>
                        <AccountStatus account={account} />
                        <span className="account-secondary">
                          {account.emailVerified ? '邮箱已验证' : '邮箱未验证'}
                        </span>
                      </td>
                      <td className="account-date">
                        {formatDateTime(account.createdAt)}
                      </td>
                      <td>
                        <button
                          className="admin-btn admin-btn-quiet"
                          type="button"
                          onClick={() => openDetails(account)}
                          aria-label={`查看账号 ${account.name || account.email}`}
                        >
                          查看
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="accounts-cards">
                {accounts.map((account) => (
                  <article className="account-card" key={account.userId}>
                    <div className="account-card-top">
                      <div className="account-identity">
                        <span className="account-avatar" aria-hidden="true">
                          {account.name.slice(0, 1) || '道'}
                        </span>
                        <div>
                          <h4>
                            {account.name || '未设置昵称'}
                            {account.userId === operatorUserId && (
                              <small className="account-self">本人</small>
                            )}
                          </h4>
                          <span className="account-secondary account-email">
                            {account.email}
                          </span>
                        </div>
                      </div>
                      <AccountStatus account={account} />
                    </div>
                    <div className="account-card-meta">
                      <span>
                        {account.activeCultivator
                          ? `${account.activeCultivator.name} · ${account.activeCultivator.realm}${account.activeCultivator.realmStage}`
                          : '尚无角色'}
                      </span>
                      <span>
                        {account.emailVerified ? '邮箱已验证' : '邮箱未验证'}
                      </span>
                    </div>
                    <div className="account-card-bottom">
                      <span>{account.activeSessionCount} 个有效会话</span>
                      <button
                        className="admin-btn"
                        type="button"
                        onClick={() => openDetails(account)}
                        aria-label={`查看账号 ${account.name || account.email}`}
                      >
                        查看详情 <span aria-hidden="true">→</span>
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            </>
          )}
        </div>
        {hasLoaded && (
          <div className="accounts-pagination">
            <span aria-live="polite">
              共 {total} 个账号 · 第 {page} / {totalPages} 页
              {loading ? ' · 加载中…' : ''}
            </span>
            <div>
              <button
                className="admin-btn"
                type="button"
                disabled={loading || offline || page <= 1}
                onClick={() => setPage((value) => Math.max(1, value - 1))}
              >
                上一页
              </button>
              <button
                className="admin-btn"
                type="button"
                disabled={loading || offline || page >= totalPages}
                onClick={() =>
                  setPage((value) => Math.min(totalPages, value + 1))
                }
              >
                下一页
              </button>
            </div>
          </div>
        )}
      </section>

      <AdminDrawer
        isOpen={Boolean(selectedAccount)}
        onClose={requestClose}
        title="账号详情"
        busy={busy}
        className="account-drawer"
        footer={
          selectedAccount ? (
            exitRequested ? (
              <div className="account-drawer-buttons">
                <button
                  className="admin-btn"
                  type="button"
                  onClick={cancelExit}
                >
                  继续留在此页
                </button>
                {!busy && (
                  <button
                    className="admin-btn admin-btn-danger"
                    type="button"
                    onClick={discardChanges}
                  >
                    放弃更改
                  </button>
                )}
              </div>
            ) : action ? (
              <div className="account-drawer-buttons">
                <button
                  className="admin-btn"
                  type="button"
                  onClick={cancelAction}
                  disabled={busy}
                >
                  取消
                </button>
                <button
                  className={`admin-btn ${action === 'unban' ? 'admin-btn-primary' : 'admin-btn-danger'}`}
                  type="submit"
                  form="account-action-form"
                  disabled={
                    mutationDisabled || (action === 'ban' && !banReason.trim())
                  }
                >
                  {actionLabel}
                </button>
              </div>
            ) : (
              <div className="account-drawer-buttons account-drawer-default-actions">
                <button
                  className="admin-btn admin-btn-primary"
                  type="button"
                  disabled={mutationDisabled}
                  onClick={() => beginAction('email')}
                >
                  改绑邮箱
                </button>
                <button
                  className="admin-btn"
                  type="button"
                  id="account-more-actions-trigger"
                  aria-expanded={moreOpen}
                  aria-controls="account-more-actions"
                  disabled={mutationDisabled}
                  onClick={() => {
                    setMoreOpen((current) => !current);
                    if (moreOpen)
                      window.requestAnimationFrame(() =>
                        document
                          .getElementById('account-more-actions-trigger')
                          ?.focus(),
                      );
                  }}
                >
                  更多操作{' '}
                  <span aria-hidden="true">{moreOpen ? '⌄' : '⌃'}</span>
                </button>
              </div>
            )
          ) : undefined
        }
      >
        {selectedAccount && (
          <div className="account-detail">
            <div className="account-detail-identity">
              <span
                className="account-avatar account-avatar--large"
                aria-hidden="true"
              >
                {selectedAccount.name.slice(0, 1) || '道'}
              </span>
              <div>
                <h3>{selectedAccount.name || '未设置昵称'}</h3>
                <p>{selectedAccount.email}</p>
                <AccountStatus account={selectedAccount} />
                {selectedAccount.userId === operatorUserId && (
                  <span className="account-self">当前管理员</span>
                )}
              </div>
            </div>
            {offline && (
              <div
                className="accounts-notice accounts-notice--danger"
                role="status"
              >
                网络已断开，恢复连接后才可提交操作。
              </div>
            )}
            {notice && (
              <div
                className={`accounts-notice accounts-notice--${notice.tone}`}
                role={notice.tone === 'danger' ? 'alert' : 'status'}
              >
                <p>{notice.message}</p>
                {notice.status === 401 && (
                  <a className="admin-btn" href="/login">
                    重新登录
                  </a>
                )}
              </div>
            )}
            {sessionRevokePending.has(selectedAccount.userId) && (
              <div
                className="accounts-notice accounts-notice--danger"
                role="status"
              >
                <p>该账号还有待完成的会话撤销，请及时重试下线。</p>
                {!action && !exitRequested && (
                  <button
                    className="admin-btn admin-btn-danger"
                    type="button"
                    disabled={mutationDisabled}
                    onClick={() => beginAction('revoke')}
                  >
                    重试下线
                  </button>
                )}
              </div>
            )}
            {exitRequested ? (
              <section className="account-action-panel">
                <h3 tabIndex={-1} ref={actionHeading}>
                  {busy ? '正在处理账号操作' : '有尚未保存的修改'}
                </h3>
                <p>
                  {busy
                    ? '请等待操作结果，避免重复提交。'
                    : '离开将丢弃本次填写的内容，你也可以继续编辑。'}
                </p>
              </section>
            ) : action ? (
              <form
                id="account-action-form"
                className="account-action-panel"
                onSubmit={(event) => void submitAction(event)}
              >
                <h3 tabIndex={-1} ref={actionHeading}>
                  {actionTitle}
                </h3>
                {action === 'email' && (
                  <>
                    <p>
                      新邮箱会变为未验证状态，全部现有会话将撤销。此操作不发送验证邮件，玩家使用新邮箱登录时进入验证流程。
                    </p>
                    {operatorUserId === selectedAccount.userId && (
                      <p className="account-action-warning">
                        这是当前管理员账号，成功后你也会退出登录。
                      </p>
                    )}
                    <label>
                      <span className="admin-label">新邮箱</span>
                      <input
                        className="admin-field"
                        type="email"
                        autoComplete="off"
                        maxLength={254}
                        required
                        value={newEmail}
                        disabled={busy}
                        placeholder="player@example.com"
                        onChange={(event) => setNewEmail(event.target.value)}
                      />
                    </label>
                    <label>
                      <span className="admin-label">再次确认新邮箱</span>
                      <input
                        className="admin-field"
                        type="email"
                        autoComplete="off"
                        maxLength={254}
                        required
                        value={confirmEmail}
                        disabled={busy}
                        placeholder="再次输入完整新邮箱"
                        onChange={(event) =>
                          setConfirmEmail(event.target.value)
                        }
                      />
                    </label>
                  </>
                )}
                {action === 'ban' && (
                  <>
                    <p>
                      封禁后玩家将无法登录，全部现有登录会话会被撤销。请核对账号并填写具体原因。
                    </p>
                    <label>
                      <span className="admin-label">封禁原因</span>
                      <textarea
                        className="admin-field"
                        rows={4}
                        required
                        maxLength={500}
                        value={banReason}
                        disabled={busy}
                        placeholder="填写封禁原因（最多 500 字）"
                        onChange={(event) => setBanReason(event.target.value)}
                      />
                      <span className="account-secondary account-field-hint">
                        {banReason.length}/500
                      </span>
                    </label>
                    <label>
                      <span className="admin-label">封禁期限</span>
                      <select
                        className="admin-field"
                        value={banDuration}
                        disabled={busy}
                        onChange={(event) =>
                          setBanDuration(
                            event.target.value as AdminAccountBanDuration,
                          )
                        }
                      >
                        <option value="1_day">1 天</option>
                        <option value="7_days">7 天</option>
                        <option value="30_days">30 天</option>
                        <option value="permanent">永久</option>
                      </select>
                    </label>
                  </>
                )}
                {action === 'revoke' && (
                  <>
                    <p>
                      将撤销此账号的全部登录会话，玩家需要重新登录。请确认后继续。
                    </p>
                    {operatorUserId === selectedAccount.userId && (
                      <p className="account-action-warning">
                        这是当前管理员账号，操作成功后将返回登录页。
                      </p>
                    )}
                  </>
                )}
                {action === 'unban' && (
                  <p>
                    解除封禁后，此账号可以重新登录游戏。原有登录会话不会恢复。
                  </p>
                )}
              </form>
            ) : moreOpen ? (
              <section
                id="account-more-actions"
                className="account-more-actions"
                aria-labelledby="account-more-actions-title"
              >
                <h3
                  id="account-more-actions-title"
                  tabIndex={-1}
                  ref={actionHeading}
                >
                  更多账号操作
                </h3>
                <p>选择操作后核对账号并确认，不会立即执行。</p>
                {selectedAccount.banned ? (
                  <button
                    className="admin-btn"
                    type="button"
                    disabled={mutationDisabled}
                    onClick={() => beginAction('unban')}
                  >
                    解除封禁
                  </button>
                ) : (
                  <button
                    className="admin-btn admin-btn-danger"
                    type="button"
                    disabled={
                      mutationDisabled ||
                      selectedAccount.userId === operatorUserId
                    }
                    onClick={() => beginAction('ban')}
                  >
                    {selectedAccount.userId === operatorUserId
                      ? '不可封禁本人'
                      : '封禁账号'}
                  </button>
                )}
                <button
                  className="admin-btn admin-btn-danger"
                  type="button"
                  disabled={mutationDisabled}
                  onClick={() => beginAction('revoke')}
                >
                  {sessionRevokePending.has(selectedAccount.userId)
                    ? '重试下线'
                    : '强制下线'}
                </button>
                <button
                  className="admin-btn admin-btn-quiet"
                  type="button"
                  onClick={() => {
                    setMoreOpen(false);
                    focusDetailTab();
                  }}
                >
                  返回账号资料
                </button>
              </section>
            ) : (
              <>
                <div
                  className="account-tabs"
                  role="tablist"
                  aria-label="账号详情分类"
                >
                  {TABS.map((tab, index) => (
                    <button
                      key={tab.id}
                      id={`account-tab-${tab.id}`}
                      role="tab"
                      type="button"
                      aria-selected={activeTab === tab.id}
                      aria-controls={`account-panel-${tab.id}`}
                      tabIndex={activeTab === tab.id ? 0 : -1}
                      onClick={() => setActiveTab(tab.id)}
                      onKeyDown={(event) => moveTab(event, index)}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
                <section
                  className="account-tab-panel"
                  id={`account-panel-${activeTab}`}
                  role="tabpanel"
                  aria-labelledby={`account-tab-${activeTab}`}
                  tabIndex={0}
                >
                  {activeTab === 'profile' && (
                    <>
                      <dl className="account-facts">
                        <div>
                          <dt>账号昵称</dt>
                          <dd>{selectedAccount.name || '未设置'}</dd>
                        </div>
                        <div>
                          <dt>账号 ID</dt>
                          <dd className="account-mono">
                            {selectedAccount.userId}
                          </dd>
                        </div>
                        <div>
                          <dt>登录邮箱</dt>
                          <dd>
                            {selectedAccount.email}
                            <span
                              className={`account-badge account-badge--${selectedAccount.emailVerified ? 'green' : 'muted'}`}
                            >
                              {selectedAccount.emailVerified
                                ? '已验证'
                                : '未验证'}
                            </span>
                          </dd>
                        </div>
                        <div>
                          <dt>登录方式</dt>
                          <dd>
                            {selectedAccount.providers.length
                              ? selectedAccount.providers
                                  .map(
                                    (provider) =>
                                      PROVIDER_LABELS[provider] ?? provider,
                                  )
                                  .join('、')
                              : '暂无'}
                          </dd>
                        </div>
                        <div>
                          <dt>注册时间</dt>
                          <dd>{formatDateTime(selectedAccount.createdAt)}</dd>
                        </div>
                        {selectedAccount.banned && (
                          <>
                            <div>
                              <dt>封禁原因</dt>
                              <dd>{selectedAccount.banReason || '未填写'}</dd>
                            </div>
                            <div>
                              <dt>封禁截止</dt>
                              <dd>
                                {selectedAccount.banExpires
                                  ? formatDateTime(selectedAccount.banExpires)
                                  : '永久'}
                              </dd>
                            </div>
                          </>
                        )}
                      </dl>
                    </>
                  )}
                  {activeTab === 'character' &&
                    (selectedAccount.activeCultivator ? (
                      <dl className="account-facts">
                        <div>
                          <dt>角色名</dt>
                          <dd>{selectedAccount.activeCultivator.name}</dd>
                        </div>
                        <div>
                          <dt>当前境界</dt>
                          <dd>
                            {selectedAccount.activeCultivator.realm}
                            {selectedAccount.activeCultivator.realmStage}
                          </dd>
                        </div>
                        <div>
                          <dt>角色 ID</dt>
                          <dd className="account-mono">
                            {selectedAccount.activeCultivator.id}
                          </dd>
                        </div>
                        <div>
                          <dt>最近活跃</dt>
                          <dd>
                            {formatDateTime(
                              selectedAccount.activeCultivator.lastActiveAt,
                            )}
                          </dd>
                        </div>
                      </dl>
                    ) : (
                      <div className="admin-empty">
                        <strong>尚无活跃角色</strong>
                        <p>该账号当前没有可展示的角色资料。</p>
                      </div>
                    ))}
                  {activeTab === 'sessions' && (
                    <>
                      <dl className="account-facts">
                        <div>
                          <dt>有效会话</dt>
                          <dd>
                            <strong>
                              {selectedAccount.activeSessionCount}
                            </strong>{' '}
                            个
                          </dd>
                        </div>
                        <div>
                          <dt>最近会话</dt>
                          <dd>
                            {formatDateTime(selectedAccount.lastSessionAt)}
                          </dd>
                        </div>
                      </dl>
                      <p className="account-session-note">
                        有效会话表示尚未过期的登录凭据，不代表玩家正在在线游玩。
                      </p>
                      <div className="account-operations">
                        <h4>登录管理</h4>
                        <p>强制下线会撤销所有设备的会话，玩家需要重新登录。</p>
                        <button
                          className="admin-btn admin-btn-danger"
                          type="button"
                          disabled={mutationDisabled}
                          onClick={() => beginAction('revoke')}
                        >
                          {sessionRevokePending.has(selectedAccount.userId)
                            ? '重试下线'
                            : '强制下线'}
                        </button>
                      </div>
                    </>
                  )}
                </section>
              </>
            )}
          </div>
        )}
      </AdminDrawer>
    </div>
  );
}
