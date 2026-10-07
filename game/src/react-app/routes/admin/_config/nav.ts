import type { AdminIconName } from '../_components/AdminIcon';

export interface AdminNavItem {
  title: string;
  description: string;
  href: string;
}
export interface AdminNavGroup {
  id: string;
  title: string;
  icon: AdminIconName;
  items: AdminNavItem[];
}

export const adminOverview: AdminNavItem = {
  title: '总览',
  description: '查看运营概况',
  href: '/admin',
};
export const adminNavGroups: AdminNavGroup[] = [
  {
    id: 'players',
    title: '玩家管理',
    icon: 'users',
    items: [
      {
        title: '旧功法迁移',
        description: '查看旧版功法兑换状态与异常记录',
        href: '/admin/manual-migration',
      },
      {
        title: '账号管理',
        description: '查询账号与管理登录状态',
        href: '/admin/accounts',
      },
      {
        title: '灵石收支',
        description: '按玩家查看每日收入与支出',
        href: '/admin/spirit-stones',
      },
      {
        title: '在线人数',
        description: '查看实时在线与峰值',
        href: '/admin/online-users',
      },
      {
        title: '用户反馈',
        description: '查看和管理用户反馈',
        href: '/admin/feedback',
      },
    ],
  },
  {
    id: 'messages',
    title: '消息与社群',
    icon: 'message',
    items: [
      {
        title: '游戏公告',
        description: '认证页横幅公告配置',
        href: '/admin/announcement',
      },
      {
        title: '游戏邮件',
        description: '公告与奖励批量发放',
        href: '/admin/broadcast/game-mail',
      },
      {
        title: '邮箱群发',
        description: '面向已验证邮箱用户',
        href: '/admin/broadcast/email',
      },
      {
        title: '模板中心',
        description: '运营文案模板管理',
        href: '/admin/templates',
      },
      {
        title: 'QQ交流群',
        description: '玩家社群 QQ 群号配置',
        href: '/admin/community-group',
      },
    ],
  },
  {
    id: 'game',
    title: '游戏配置',
    icon: 'game',
    items: [
      {
        title: '跨服接入',
        description: '站点身份、互信与跨服切磋接入',
        href: '/admin/cross-server',
      },
      {
        title: '秘境管理',
        description: '开启或关闭探索秘境',
        href: '/admin/secret-realms',
      },
      {
        title: '蜃楼敌人',
        description: '按周查看与手动生成敌人',
        href: '/admin/tower-enemy-sets',
      },
      {
        title: '道具库',
        description: '材料与灵种管理、自动生成配置',
        href: '/admin/item-library',
      },
      {
        title: '声望商店管理',
        description: '配置天骄宝阁兑换商品',
        href: '/admin/reputation-shop',
      },
      {
        title: '宗门宝库管理',
        description: '配置宗门贡献兑换商品',
        href: '/admin/sect-shop',
      },
    ],
  },
  {
    id: 'rewards',
    title: '活动与赞助',
    icon: 'gift',
    items: [
      {
        title: '兑换码管理',
        description: '活动兑换码创建与停用',
        href: '/admin/redeem-codes',
      },
      {
        title: '功德簿管理',
        description: '赞助订单与认领处理',
        href: '/admin/sponsorship',
      },
    ],
  },
  {
    id: 'monitoring',
    title: '监控与调试',
    icon: 'monitor',
    items: [
      {
        title: 'LLM 观测',
        description: '查看模型调用与使用量',
        href: '/admin/llm-metrics',
      },
    ],
  },
];
export const adminNavItems = [
  adminOverview,
  ...adminNavGroups.flatMap((group) => group.items),
];
export function resolveAdminNavigation(pathname: string): {
  item: AdminNavItem;
  group?: AdminNavGroup;
} {
  for (const group of adminNavGroups) {
    const item = group.items.find(
      (candidate) =>
        pathname === candidate.href ||
        pathname.startsWith(`${candidate.href}/`),
    );
    if (item) return { item, group };
  }
  return { item: adminOverview };
}
