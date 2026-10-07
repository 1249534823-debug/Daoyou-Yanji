> 本文记录原上线部署；公开移除版已移除后台人机与战力模板，尚未替换线上运行文件。

# 衍极界跨服切磋部署与维护

## 当前部署结构

正式站点：https://daoyou.yanji.sbs

玩家入口：/game/cross-server。后台入口：/admin/cross-server。公开接入地址：https://daoyou.yanji.sbs/api/cross-server/v1。

生产项目仍采用既有 Hono/Bun 架构，保留天灵秘境、后台配置和品牌定制。本次在原项目加入页面、导航、回放来源和三个数据模型；跨服 API 使用最新官方 master 332cac362e6cb4fcfc89d51e0823ab2cc7ccd1ac 的独立服务，复用本站正常认证、数据库与角色锁，不启动第二份游戏任务或秘境 Worker。

原项目目录：/data/projects/daoyou。完整最新跨服源码：/data/projects/daoyou-cross-server-20261008。适配与验证工作树：/data/projects/daoyou-cross-live-20261008。部署配置：/data/projects/daoyou-deploy/compose.yaml。本次发布目录：/data/projects/daoyou-deploy/releases/cross-server-20261008-0401。受限配置目录：/data/projects/daoyou-deploy/cross-server。

站点 UUID：f9d54206-f43d-4930-bad4-56ce5f9fe14f。公钥 SHA-256 指纹：9dc4852c4a49745270f055ad9b6d401a790f246449df95cc5d01ab771194fac0。协议：wanjie-federation-v1。适配器：daoyou-v6-auto-v1。战斗规则 hash：b331b30e1d83905004041dcdd0d67d50e37d3fc01451bd69a157b313ce9cb165。

## 接入其他站

1. 对站安装相同跨服模块或实现同一协议，战斗规则 hash 必须一致。仅安装原版项目不会自动获得跨服接口。
2. 双方管理员进入「跨服接入」，交换公开接入地址和公钥指纹。
3. 读取对站信息后，通过各自可信渠道核对指纹。登记默认关闭；分别启用后检查双向接入。
4. 玩家主动开启切磋，并具备现行 V6 宗门构筑，才会出现在对站目录。本人接受来访邀战后自动战斗。
5. 本站不预先信任任何测试站点。对站不共享本服数据库、账号密码、签名私钥或资源。

切磋不扣资源，不结算奖励，不搬运物品。邀战有效期 15 分钟，最多 3 场未完成的发出邀战、10 场待处理来访；双方分别保存战报，发起站复算结果。

## 服务与监控

在部署目录操作：

```sh
cd /data/projects/daoyou-deploy
docker compose ps
docker compose logs --tail=100 cross-server
docker compose logs --tail=100 app
curl --fail --silent http://127.0.0.1:38158/internal/cross-server/ready
curl --fail --silent http://127.0.0.1:38148/api/ready
curl --fail --silent https://daoyou.yanji.sbs/api/cross-server/v1/manifest
```

跨服服务只绑定回环端口 38158，公网经 HTTPS Nginx 转发。内部 ready 路径不向公网开放。容器健康检查每 30 秒验证数据库和 Redis，日志轮转为 10 MiB × 3，进程退出时自动重启，关闭时先排空请求。跨服容器限制内存 512 MiB，并以普通用户、只读文件系统运行。

Nginx 原有访问与错误日志继续位于 /www/wwwlogs/daoyou.yanji.sbs.log 和 /www/wwwlogs/daoyou.yanji.sbs.error.log。监控应关注服务健康、5xx、跨站签名失败、同步失败和数据库／Redis 可用性；不要将 Cookie、验证码或密钥写入告警。

## 备份与升级

本次上线前完整备份：/data/backups/daoyou-cross-server-20261008-0401。包含 PostgreSQL dump、原源码归档、原运行文件、Compose、环境配置和 Nginx 配置；该目录为受限目录，不可放入网页根目录。

私钥保存在 identity.env，运行配置保存在 runtime.env，权限均为 0600。升级必须保留 identity.env 的 UUID 与私钥。不要再次生成身份、提交配置到 Git、把私钥复制给对站，或把 local 联调配置部署到公网。

升级前备份数据库、当前运行文件、配置与身份。在隔离恢复库验证迁移，处理完未结束邀战后再升级双方战斗规则；规则 hash 不一致时无法建立新的兼容切磋。原 Hono 项目不能直接执行最新版 monorepo 的整套历史迁移；本次原项目追加迁移为 0068_cross_server_federation.sql。

例行数据库备份：

```sh
docker exec daoyou-db-1 pg_dump -U daoyou -d daoyou -Fc > database.dump
```

备份文件须设为 0600，放在受限目录，并定期验证可恢复。更新 env 后需重建跨服容器才生效：

```sh
docker compose up -d --no-deps --force-recreate cross-server
```

## 代码回滚

常规回滚只恢复应用、页面和代理配置，不删除跨服表、不回灌数据库，以保留上线后的玩家进度、邀战幂等状态和战报。

1. 暂停新邀战，必要时创建 stability-maintenance 文件，让 API 临时返回 503。
2. 从本次备份恢复原 Compose 与 Nginx，恢复 dist 和 output/client 的原运行文件。原文件目录另保留在发布目录下的 previous-dist 和 previous-client。
3. 执行 /www/server/nginx/sbin/nginx -t -c /www/server/nginx/conf/nginx.conf，成功后以同一二进制和配置执行 -s reload；用恢复的 Compose 重建 app，并执行 docker stop daoyou-cross-server-1 停止跨服服务。
4. 原应用 ready、页面和登录恢复后删除 maintenance 文件。
5. 保留受限身份文件与三个跨服表。旧版本无法展示跨服战报来源，历史数据仍须保留，待重新部署本模块后继续读取。

数据库整库恢复只用于灾难恢复，须停止所有写入服务、先备份当前库，并单独验证恢复步骤；不得作为普通代码回滚。

## 验证记录

隔离恢复库中新增三个跨服表后，原有 86 个业务／认证表的行数与内容指纹完全一致，原 18 个角色保留。原站邮箱验证码登录产生的真实会话可直接访问独立跨服 API。原前端、后端、秘境 Worker 构建通过；本次修改文件的 Prettier 与 ESLint 通过，回放纯单元测试 10/10 通过。

原分支全量 ESLint 在三个未修改的历史 scripts 文件中有 24 个错误，本次没有修补或隐藏。最新模块的全量规则测试此前确认有一个原基线同样出现的 tower timeout；部署验证记录明确保留这一限制。

两站联调通过正常邮箱验证码注册、角色生成保存、宗门加入与流派启用，完成一场 29 回合切磋，双方摘要 1b263716568a7553e7f707b005bed39fe3bf922c1a38f8e495b687019ac4d276 一致，切磋前后两位角色持久化行指纹完全一致。双端回放、逐行动播放、原站战绩列表与 12 个场景／尺寸检查通过，浏览器页面错误为零。战报接口对匿名、非法 UUID、不存在 UUID 分别返回 401／400／404。

正式迁移后账号仍为 23 个、角色仍为 18 个；新表全部为空，未登记测试站或创建生产测试账号。正式 HTTPS ready／manifest 返回 200，未登录玩家和管理员 API 返回 401，内部与开发路径返回 404。应用、跨服服务、数据库容器均健康；API 切换暂停约 6.83 秒。生产登录页面由匿名浏览器检查，生产账号内的操作以隔离恢复库的真实会话流程作为验证证据。

### 本次实际检查命令

原项目使用 Node 24.18.0 容器执行现有 TypeScript／Vite／Vitest 工具，保持 Bun 服务运行方式和原锁文件：

```sh
node node_modules/prettier/bin/prettier.cjs --check <本次改动的源文件>
node node_modules/eslint/bin/eslint.js <本次改动的源文件>
node node_modules/typescript/lib/tsc.js -b tsconfig.app.json
node node_modules/vite/bin/vite.js build
node node_modules/typescript/lib/tsc.js -b tsconfig.node.json
node node_modules/vite/bin/vite.js build --config vite.server.config.ts
node node_modules/vite/bin/vite.js build --config vite.secret-realm-worker.config.ts
node node_modules/vitest/vitest.mjs run src/shared/combat-v6/replay.test.ts --maxWorkers=1
```

完整 ESLint 已执行并记录原有 24 个脚本错误；本次所有修改源文件的独立 ESLint 与 Prettier 均通过。未重复运行原项目全部纯规则测试；部署改动集中于路由、回放来源、追加数据模型和独立服务，采用上述静态检查、真实数据库迁移及浏览器流程验证。独立最新 API 的类型检查、oxlint、构建和 pnpm 生产部署打包均通过。
