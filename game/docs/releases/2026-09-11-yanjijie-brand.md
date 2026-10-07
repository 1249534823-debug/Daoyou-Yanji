# 衍极界更名发布记录

- 上线时间：2026-09-11T01:00:31Z
- 入口：https://daoyou.yanji.sbs
- 构建标识：0931b2c1-3960-4891-a8c2-c6cec6209ef2
- 基于当前已部署的原生秘境版本，更名不修改战斗、奖励或账号数据模型。

## 变更

- 品牌统一为“衍极界”，英文登录页标识为 YANJI JIE。
- 更新浏览器标题、iOS/PWA 安装名称、登录/注册/找回密码页面、安装提示、分享与战谱入口、后台标题及广播示例。
- 更新验证码、验证邮箱、重置密码和功德相关系统邮件文案，以及生产 MAIL_FROM 显示名；地址及凭证保持原配置。
- 启动画面的标题、印章、提示和口号换用衍极界矢量素材，并使用新资源路径避免旧缓存。
- 新增公开开源致谢及许可证原文，保留 ChurchTao/Daoyou 原作者与贡献者署名；上游文档、社区名录和赞助资料明确标注来源。

## 验证

- 定向 ESLint 通过。
- TypeScript：tsc -b tsconfig.node.json tsconfig.app.json 通过。
- Vite client、server、battle worker 构建通过。
- 390×844、430×932、768×1024、1440×900 登录页面检查通过，无横向溢出或脚本错误。
- 邮箱/密码登录、注册、找回密码入口标题检查通过。
- 启动画面所有图片成功加载，手机实测名称正确。
- 当前源代码和构建产物中无旧产品品牌；公开致谢中保留上游项目名。
- 公网 index、manifest、version、启动标题/印章、致谢及许可证与候选文件逐字节匹配。
- 运行中容器服务端及 worker SHA-256 与候选产物一致。
- 线上健康接口 success=true，Redis/NATS/messaging 均为 up；容器 running，OOM=false，RestartCount=0。
- 已验证生产 MAIL_FROM 包含新名称；未发送测试邮件，未进入真实玩家或管理员会话。
- 本次为文字及资源更名，无数据库迁移；未重复运行不相关的全量战斗测试。

## 回退资料

完整更名前源码、dist、client、部署环境与 compose 备份：/data/backups/daoyou-brand-20260911。
部署脚本：output/deploy-yanjijie.sh。脚本在健康检查失败时恢复上一版代码和邮件配置。
验证详情：output/yanjijie-preview-verification.json、output/yanjijie-live-verification.json、output/yanjijie-release-sha256.txt。
