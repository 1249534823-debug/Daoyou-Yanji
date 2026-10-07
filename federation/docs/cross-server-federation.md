# 跨服切磋与第三方站点接入

本功能基于官方 master `332cac362e6cb4fcfc89d51e0823ab2cc7ccd1ac` 的 NestJS / pnpm monorepo。玩家可查看已信任站点的道友、发送邀战，并在对方同意后进行 V6 自动切磋。双方分别保存可回放战报，发起站会用同一冻结构筑与种子复算结果。切磋不结算奖励、不扣除角色资源，也不搬运账号或物品。

## 安装与启用

1. 在同一新版项目基线上安装变更，使用 Node >=24.18.0、pnpm 10.34.6。双方的 combatHash 必须一致；接口及页面的小改动不会影响该值，战斗代码或内容变化会影响它。
2. 保留已有环境配置，按项目标准流程备份并执行新游戏数据库迁移。新迁移仅创建跨服站点、角色授权、挑战三个表，认证库结构不变。先验证迁移，再构建、更新配套 API 与 SPA。
3. 为每个站点生成独立身份：

```sh
node scripts/cross-server-identity.mjs --name "示例修仙站" --url https://example.com/api/cross-server/v1 --output env/cross-server.env
```

文件以 0600 权限创建，已有文件不会被覆盖。将其配置加入现有 API 启动环境；例如在原有 Node 启动命令上追加 `--env-file=env/cross-server.env`。不要将密钥写入前端、公开接入资料或 Git。升级时保留站点 UUID 与私钥，否则既有信任会失效。

4. 管理员进入 `/admin/cross-server`，复制本站公开接入信息。在双方管理页输入对站地址，读取信息，并通过站外渠道核对 SHA-256 公钥指纹；分别登记、启用，最后点击「检查双向接入」。登记默认关闭，不会自动信任发现到的站点。公钥身份变化时检查会关闭接入。
5. 玩家在导航「争锋 → 跨服切磋」或 `/game/cross-server` 开启切磋。需具备现行 V6 可编译宗门构筑。角色只有主动开启后才出现在对站目录；出战构筑在邀战／接受时分别从各站服务器读取，玩家浏览器不能提交自定数值。

旧 Hono/Bun 分支不能直接应用新版文件路径。本次衍极界使用独立跨服服务（cross-server-main.js）复用原站认证、数据库与角色锁，原项目补充配套页面、战报来源和追加迁移，保留原游戏任务与定制功能。独立入口不启动游戏调度和第二份 Worker。完整整站升级仍需按项目发布清单单独处理。

## 使用与恢复

- 邀战有效期 15 分钟，每个角色最多 3 场未结束的发出邀战、10 场待处理来访邀战。对站道友目录每页 20 人。
- 对方点击「接受切磋」后自动战斗。发起站打开页面时轮流同步未结束邀战；也可手动「同步状态」。已送达且尚未接受的邀战可取消。
- 玩家页优先保留未结束的邀战，列表最多显示 50 条。更早的已完成战报可从现有战绩页查看。
- 网络失败保留挑战 UUID、原始冻结构筑及状态。重复同步／接受不新建战斗，重新启动 API 后仍可恢复。
- 发送结果未知时，发起站先查同一 UUID，再决定是否重发。只在接收站以签名回执证明尚不存在且已过期时结束未送达记录；不会把已经在对站完成的战斗误判为超时。
- 关闭角色切磋会移出目录并婉拒待处理来访。已发出邀战需要单独取消，已完成战报保留。
- 接受与取消／婉拒并发时，接收站数据库条件更新决定唯一终态。战报归档与完成状态在同一事务提交。
- 管理员关闭接入后停止新通信。恢复互信后可以重新同步旧记录。跨战斗规则升级的未完成邀战应先处理完；旧构筑不会按新规则静默结算。

## 与其他站兼容

相同新版万界道友站点安装同一模块即可接入，不需要共享数据库、Redis、账号密码或签名私钥。不同技术栈可实现下面的 HTTP 协议，并使用发布的 `@daoyou/game-domain/combat/cross-server` 构筑类型、`@daoyou/game-rules/combat/cross-server` 适配器和同一 combatHash 对应的 V6 战斗规则。任意不同游戏引擎不保证兼容。

协议：`wanjie-federation-v1`；战斗适配器：`daoyou-v6-auto-v1`。JSON Schema 可由本项目契约及规则层 Zod Schema 生成；权威定义是 `packages/contracts/src/crossServer.ts` 和 `packages/game-rules/src/combat/cross-server.ts`。

### 地址与身份

此 NestJS 模块的接入路径为 `/api/cross-server/v1`，基地址为 `https://站点/api/cross-server/v1`。其他协议实现可使用自己的基路径。反向代理须保留签名中的完整路径与查询串；改写路径前缀的部署需要配套调整路由与签名，不能只修改 apiBaseUrl。只允许 HTTPS 公网单播目标，不跟随重定向。DNS 全部结果先检查，再固定地址建立请求，保留原域名的 TLS 证书验证。无 Cookie、无压缩请求／响应，单次请求或响应最多 256 KiB。

`GET /manifest` 无需签名，返回：

```json
{
  "protocol": "wanjie-federation-v1",
  "adapter": "daoyou-v6-auto-v1",
  "siteId": "站点UUID",
  "name": "站点名称",
  "apiBaseUrl": "https://example.com/api/cross-server/v1",
  "publicKey": "Ed25519 SPKI DER 的标准 Base64",
  "combatHash": "战斗运行时依赖闭包的64位小写SHA256"
}
```

首次读取 manifest 只用于展示待核验身份。管理员线下核对公钥指纹后方可信任；既有身份不会被发现信息自动替换。此版本固定绑定已登记站点的 ID、公钥和地址，后台不覆盖旧身份。更换身份或地址需单独制定迁移方案，升级请保留原有身份。

### 请求认证

所有其他接入接口都必须签名，并且接收站已启用发送站的公钥。每个请求设置以下头：

| 头               | 值                                        |
| ---------------- | ----------------------------------------- |
| `x-dy-protocol`  | `wanjie-federation-v1`                    |
| `x-dy-site`      | 发送站 UUID                               |
| `x-dy-audience`  | 接收站 UUID                               |
| `x-dy-timestamp` | 十位 Unix 秒，双方时差最多 300 秒         |
| `x-dy-nonce`     | 每次 HTTP 请求全新 UUID；重试使用新 nonce |
| `x-dy-signature` | 下述消息的 Ed25519 签名，标准 Base64      |

待签消息为以下字符串用 LF 拼接，末尾没有 LF：

```text
wanjie-federation-v1
request
HTTP方法，例如POST
接收站看到的完整路径和原始查询串
发送站UUID
接收站UUID
Unix秒
nonce UUID
原始请求体字节的SHA256小写hex
```

GET 的请求体是空字节，POST 使用 UTF-8 JSON。签名绑定实际字节而非解析后 JSON；代理不得重排或重写请求体。接收站记录有效 nonce 601 秒，拒绝重放；每个发送站最多 120 次有效签名请求／分钟。需持久可用的 Redis，失败时拒绝请求。

### 签名响应

成功响应 HTTP 200、`application/json`，结构为 `{ "data": ..., "signature": "Base64" }`。响应签名消息也是 LF 拼接，无末尾 LF：

```text
wanjie-federation-v1
response
响应站UUID
请求站UUID
本次请求nonce
本次完整请求路径与查询串
data规范JSON的SHA256小写hex
```

规范 JSON 使用 ECMAScript JSON 字符串／有限数字表示；对象键按 JS UTF-16 排序、忽略 undefined 对象字段，数组保留顺序，无空白，最大嵌套深度 64。不支持非 JSON 值。跨语言适配器须保证数值序列化相同（例如 `-0` 输出 `0`）。非 200 错误不作为战斗终态证据，调用方保留邀战后重新同步。

### 接入接口

| 方法与相对路径 | 输入 | 成功 data |
| --- | --- | --- |
| `GET /ping` | 空体 | 本站 manifest |
| `GET /players?cursor=角色UUID` | 可省略 cursor | `{players:[{id,name,realm,realmStage}],nextCursor:UUID或null}`，只列主动开启角色 |
| `POST /challenges` | `{id,combatHash,targetId,expiresAt,challenger}` | 挑战回执；id 为全局挑战 UUID，challenger 为冻结战斗构筑 |
| `GET /challenges/:id` | 空体 | 挑战回执；不存在时 `{id,status:"missing",seenAt:ISO时刻}` |
| `POST /challenges/:id/cancel` | `{}` | 唯一最新挑战回执 |

回执：`{id,status,defender:{id,name,realm,realmStage},result?}`。状态仅为 pending/completed/declined/cancelled/expired。仅 completed 包含 result：`{defender:冻结构筑,battleDigest,winner:0或1或"draw",roundCount,finishedAt}`。

站内玩家 API 是 `/api/cross-server` 下的 `GET state`、`PATCH profile`、`GET peers/:peerId/players`、`POST challenges`、`POST challenges/:id/{accept,decline,cancel,sync}`，使用本站正常 active 角色会话。创建请求只接受 `{requestId,peerId,targetId}`。管理员接口位于 `/api/admin/cross-server`，使用正常 admin 权限。

参数格式无效返回 400，认证失败返回 401，未获信任返回 403，挑战冲突或重复 nonce 返回 409，体积超限返回 413，规则不兼容或邀战有效期无效返回 422，频率或待处理数量超限返回 429。客户端不得将非 200 响应当作挑战终态。

### 战斗适配与复算

冻结构筑包含永久六属性、境界、宗门、道装、功法、自动策略、已携带灵兽及炼体等级。当前 HP/MP、丹毒、资产、账号、会话和条件历史不外传。兽主、编组、规则引用和数值边界均验证；完整 Zod Schema 是唯一输入规范。

用 `SHA256("wanjie-federation-v1" + NUL + siteId + NUL + entityId)` 的前 32 个 hex 生成战斗 UUID：按 8-4-4-4-12 分组，第三组第一位设为 `5`，第四组第一位设为 `a`。对角色 UUID、灵兽 UUID、兽主引用和编组引用应用同一规则。挑战者始终 side 0，应战者 side 1。种子是 `SHA256(challengeId)` 前 8 个 hex 转无符号整数。

调用 `crossServerBattle(challenger, defender, seed, namespacedId)` 使用现行全资源 ranking 自动斗法规则。`battleDigest` 是规范 JSON `{events:trace.events,finalState:trace.finalState}` 的 SHA256。发起站必须自行重新运行，验证摘要、赢家和回合数后，才原子保存完成状态与本站可回放战报。

同一 UUID 与同一载荷幂等；同 UUID 用于不同角色、对站或载荷返回冲突。接收站只允许目标本人主动接受。双方各自只归档本站真实角色参与者，沿用原有战报访问与隐藏对方私有资源逻辑。

## 本地联调

仅在显式 `APP_ENV=local` 且 NODE_ENV 非 production 时，允许 `CROSS_SERVER_ALLOW_LOCALHOST=true` 并使用字面量 `127.0.0.1` / `::1` 的 HTTP 地址。两个站点使用独立数据库、Redis／NATS 与站点身份，绑定回环地址。禁止把 local 环境或 dev-tools 暴露公网。本地测试遵循 `docs/testing.md`，通过正式登录和现有测试角色验证。

## 回滚

先关闭新邀战，处理尚未结束记录，再更新配套 API/SPA。回滚代码前禁用跨服环境配置。保留三个新表及战报，避免丢失幂等状态；不得用 DROP 表回滚已产生的挑战。旧代码不能读取新战报 sourceType，需要按项目配套发布流程处理。
