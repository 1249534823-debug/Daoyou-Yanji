import Link from '@app/components/router/AppLink';
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { useLocation, useNavigation } from 'react-router';
import {
  adminNavGroups,
  adminOverview,
  resolveAdminNavigation,
} from '../_config/nav';
import '../admin.css';
import { AdminDrawer } from './AdminDrawer';
import { AdminIcon } from './AdminIcon';

function AdminBrand() {
  return (
    <span className="admin-brand">
      <img src="/assets/daoyou_logo.webp" alt="" />
      <span>
        <strong>
          万界道友
          <wbr />
          •衍极界
        </strong>
        <small>管理后台</small>
      </span>
    </span>
  );
}

function AdminNavigation({
  pathname,
  onNavigate,
}: {
  pathname: string;
  onNavigate?: () => void;
}) {
  const selected = resolveAdminNavigation(pathname);
  const [expanded, setExpanded] = useState<string | null>(
    selected.group?.id ?? null,
  );
  const id = useId();
  return (
    <nav aria-label="后台功能导航" className="admin-nav">
      <Link
        href={adminOverview.href}
        aria-current={pathname === '/admin' ? 'page' : undefined}
        className="admin-nav-primary"
        onClick={onNavigate}
      >
        <AdminIcon name="home" />
        <span>总览</span>
      </Link>
      {adminNavGroups.map((group) => (
        <div className="admin-nav-group" key={group.id}>
          <button
            type="button"
            className={`admin-nav-primary ${selected.group?.id === group.id ? 'admin-nav-parent-active' : ''}`}
            aria-expanded={expanded === group.id}
            aria-controls={`${id}-${group.id}`}
            onClick={() => setExpanded(expanded === group.id ? null : group.id)}
          >
            <AdminIcon name={group.icon} />
            <span>{group.title}</span>
            <AdminIcon name="chevron" className="admin-nav-chevron" />
          </button>
          <div
            id={`${id}-${group.id}`}
            className="admin-nav-children"
            hidden={expanded !== group.id}
          >
            {group.items.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                aria-current={
                  selected.item.href === item.href ? 'page' : undefined
                }
                onClick={onNavigate}
              >
                <span className="admin-nav-dot" />
                {item.title}
              </Link>
            ))}
          </div>
        </div>
      ))}
    </nav>
  );
}

interface AdminShellProps {
  adminEmail: string;
  adminUserId: string;
  children: ReactNode;
}
export function AdminShell({
  adminEmail,
  adminUserId,
  children,
}: AdminShellProps) {
  const { pathname } = useLocation();
  const navigation = useNavigation();
  const selected = resolveAdminNavigation(pathname);
  const [mobileMenu, setMobileMenu] = useState(false);
  const [offline, setOffline] = useState(() => !navigator.onLine);
  useEffect(() => {
    const update = () => setOffline(!navigator.onLine);
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);
  const mainRef = useRef<HTMLElement>(null);
  const previousPath = useRef(pathname);
  const operatorRef = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    if (previousPath.current === pathname) return;
    previousPath.current = pathname;
    const frame = requestAnimationFrame(() => {
      setMobileMenu(false);
      mainRef.current?.scrollTo({ top: 0 });
      mainRef.current?.focus({ preventScroll: true });
      operatorRef.current?.removeAttribute('open');
    });
    return () => cancelAnimationFrame(frame);
  }, [pathname]);
  useEffect(() => {
    const query = window.matchMedia('(min-width: 1024px)');
    const closeOnDesktop = () => {
      if (query.matches) setMobileMenu(false);
    };
    query.addEventListener('change', closeOnDesktop);
    return () => query.removeEventListener('change', closeOnDesktop);
  }, []);
  useEffect(() => {
    const closeOperator = (event: MouseEvent | KeyboardEvent) => {
      if (
        (event instanceof KeyboardEvent && event.key === 'Escape') ||
        (event instanceof MouseEvent &&
          event.target instanceof Node &&
          !operatorRef.current?.contains(event.target))
      )
        operatorRef.current?.removeAttribute('open');
    };
    document.addEventListener('click', closeOperator);
    document.addEventListener('keydown', closeOperator);
    return () => {
      document.removeEventListener('click', closeOperator);
      document.removeEventListener('keydown', closeOperator);
    };
  }, []);
  const closeMenu = () => setMobileMenu(false);
  return (
    <div className="admin-ui admin-shell">
      <a className="admin-skip-link" href="#admin-main">
        跳到页面内容
      </a>
      <aside className="admin-sidebar">
        <div className="admin-sidebar-brand">
          <AdminBrand />
        </div>
        <div className="admin-sidebar-scroll">
          <AdminNavigation key={selected.item.href} pathname={pathname} />
        </div>
        <footer className="admin-sidebar-footer">
          <Link href="/game">
            <AdminIcon name="back" />
            返回游戏
          </Link>
          <small>万界道友•衍极界 · 运营管理</small>
        </footer>
      </aside>
      <div className="admin-body">
        <header className="admin-topbar">
          <button
            type="button"
            className="admin-icon-btn admin-mobile-menu"
            aria-label="打开后台菜单"
            aria-expanded={mobileMenu}
            onClick={() => setMobileMenu(true)}
          >
            <AdminIcon name="menu" />
          </button>
          <div className="admin-breadcrumb" aria-label="当前位置">
            {selected.group && (
              <>
                <span>{selected.group.title}</span>
                <span className="admin-breadcrumb-separator">/</span>
              </>
            )}
            <strong>{selected.item.title}</strong>
          </div>
          <details className="admin-operator" ref={operatorRef}>
            <summary>
              <span className="admin-operator-avatar">管</span>
              <span className="admin-operator-label">管理员</span>
              <AdminIcon name="chevron" />
            </summary>
            <div className="admin-operator-popover">
              <strong>当前管理员</strong>
              <p>{adminEmail}</p>
              <small>ID：{adminUserId}</small>
              <Link href="/game">返回游戏</Link>
            </div>
          </details>
          {navigation.state === 'loading' && (
            <div
              className="admin-route-progress"
              role="progressbar"
              aria-label="正在打开页面"
            />
          )}
        </header>
        {offline && (
          <div className="admin-offline-notice" role="status">
            网络已断开，当前输入会保留在此页面。连接恢复后请重试操作。
          </div>
        )}
        <main
          id="admin-main"
          className="admin-main"
          ref={mainRef}
          tabIndex={-1}
        >
          <div className="admin-workspace">{children}</div>
        </main>
      </div>
      <AdminDrawer
        isOpen={mobileMenu}
        onClose={closeMenu}
        title={<AdminBrand />}
        side="left"
        className="admin-menu-drawer"
        footer={
          <Link href="/game" onClick={closeMenu}>
            <AdminIcon name="back" />
            返回游戏
          </Link>
        }
      >
        <AdminNavigation
          key={selected.item.href}
          pathname={pathname}
          onNavigate={closeMenu}
        />
      </AdminDrawer>
    </div>
  );
}
