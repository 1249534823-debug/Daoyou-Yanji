# 应用边界与迁移决策

日期：2026-10-04。目标：NestJS 模块化单体、React SPA，以及按职责拆分的内部编译包（tsc 输出 JavaScript 和声明文件）。

## 当前迁移目标与验收

用户已授权按顺序推进六包拆分，直到移除旧 shared 并完成验收。下面的目标替代后文历史批次中“保留三个工作区”的决策；历史实施记录不作为本轮完成证据。

| 包 | 职责 | 允许的内部生产依赖 |
| --- | --- | --- |
| constants | 元素、境界、品质等稳定基础词汇 | 无 |
| game-domain | 按领域组织的模型、Schema 与不变量 | constants；combat-core 仅类型 |
| combat-core | 确定性战斗状态、命令、执行与扩展接口 | 无 |
| game-content | 游戏内容、定义与数值表 | constants、game-domain、combat-core |
| game-rules | 资格、费用、收益、生成、投影等纯玩法计算 | constants、game-domain、combat-core、game-content |
| contracts | HTTP、资源与实时消息的请求/响应协议 | constants、game-domain、combat-core |

旧 shared workspace 已删除，不保留兼容 barrel。所有类型与运行值导入都受包方向限制；测试依赖上层玩法时，应归入拥有该玩法的包，而不是让底层包反向依赖。应用之间不互相导入，各自消费包 exports，不通过源码别名绕过边界。

实际迁移细化：装备、功法、内容定义与人物投影的模型共同引用 `SkillDef`、`LineupUnit`、`CombatV6VersionStamp` 等内核类型。将这些中立模型归入 game-domain，并允许它单向 type-only 依赖 combat-core；边界检查禁止运行值导入。这样保留权威类型、保持内核零业务依赖，也避免为了初始图形复制类型或引入无业务价值的泛型。领域包仍不依赖游戏内容、规则、契约和应用。

执行顺序和完成条件：

- [x] 固定职责和依赖图，建立可执行包边界检查。
- [x] 提取 constants 与 game-domain；清理 Web 重复纳入 shared 源码和根 shared 源码别名。
- [x] 提取 combat-core，保持确定性和既有测试覆盖。
- [x] 提取 contracts，协议不依赖规则执行器或内容注册表。
- [x] 按领域提取 game-content / game-rules，保持数值、Schema 与行为一致。
- [x] 收紧 Nest 跨领域公开入口及仓储归属，核对 Web feature 的请求、适配和状态所有权。
- [x] 删除 shared 和过渡导出；更新技能、文档、测试发现、Turbo、CI、Docker 和维护工具入口。
- [x] 完成 frozen install、lint、全部类型检查、纯逻辑测试、双应用构建及包依赖审查。
- [x] 完成本地 Docker 产物、API 启停/readiness、浏览器关键流程和资源实时恢复验收（具体范围及未覆盖项见下）。

本次不改变游戏规则、HTTP 行为、数据库模型、锁/事务/幂等语义，不执行生产部署或数据迁移。维护发布策略仍适用。每批记录实际命令与结果；未执行的运行检查保持待验收，不用构建结果替代。

### 本轮进度

2026-10-04 开始。基线有 1637 个生产 TS/TSX 文件、237 个测试文件/2398 个测试；前次只读审查的 lint、typecheck、强制构建及共享测试通过。本轮需对修改后的工作树重新验证。开始时 `.gitignore` 与 `tsconfig.base.json` 已有暂存变更，保留原样。

### 六包拆分检查点（2026-10-04）

当前有 8 个 workspace：2 个应用、6 个目标库；shared 已删除。以下批次记录保留其当时的验证数据，最终证据见本节末尾。

| 包 | 当前已归入的实现 |
| --- | --- |
| constants | 元素、境界、品质及其顺序 |
| game-domain | 角色/宗门模型、装备/功法/灵兽 Schema、背包/交易/奖励事实、完整校验构造器、战斗快照、宗门组织接口与剧情/教学/演出模型 |
| combat-core | 29 个确定性内核实现文件，独立于游戏内容与应用 |
| game-content | 装备/功法/灵兽/宗门内容、物品注册表、经济/战斗/炼丹/修为/奖励调参、材料预设、地图、剧情与教学文本、宗门组织主题 |
| game-rules | 装备/灵兽/功法/背包/交易规则、人物投影与战斗、炼丹/恢复/修炼/灵田/奖励计算、市场抽样、剧情推进与通用宗门组织 |
| contracts | 已迁入账号、管理、战斗、市场、背包、玩家/宗门资源、闭关、日志、任务、灵田、物品库、领域事件信封、悟道与阵纹协议 |

内容相关的完整校验采用显式组合：领域包的 `createBeastSchema`、`createInventoryEquipmentSchema` 和 `createInventorySchemas` 接收内容查询或校验依赖，规则包绑定当前权威目录。模型类型从同一 Schema 推导，保留未知物品/技能、阵纹部位与等级、堆叠上限、实例身份和固定物品附带属性等校验，不通过降低 Schema 严格度消除依赖。

竞技/回放收口后，shared 实现和测试均已归位，未调用的旧 barrel、冻结文案、shuffle 与 Body.json 声明已删除。当前全仓 256 个测试文件、2,409 项测试；测试增加来自协议/玩法断言分离以及校验依赖传递回归检查。

已修正内容 JSON 迁移后测试替换仍指向旧路径的问题；灵兽配置用例保留原断言。宗门组织只需要装备部位名称，已改用领域定义；其架构守卫仅检查生产源文件，避免将使用真实内容的测试误当成生产依赖。18 份已迁移 JSON/Schema 与 HEAD 原文件逐字一致。完整校验结果在每批完成后补记；构建、类型检查不能替代最终运行验收。

本检查点验证：`pnpm run typecheck` 通过（16 项任务）；`pnpm run lint` 通过（9 个 workspace、11,058 个导入及类型/测试边界）；`pnpm run test` 通过（237 文件、2,398 项）；`pnpm exec turbo run build --force` 通过（9 项构建，双应用及全部库）。Vite 仍提示 Phaser chunk 大于 500 kB，此次未调整分包。`git diff --check` 与领域/数据技能校验通过。本轮尚未执行 Docker、API 启停或浏览器验收。

生产依赖目录检查：`pnpm --filter @daoyou/api deploy --prod /tmp/daoyou-monorepo-api-check-20261004` 成功；在该独立目录中用 Node 加载 470 个公开 package exports（含 JSON）全部成功。该检查验证包发布文件与运行时解析，不代替 Docker 容器和 API 启停检查。当前 46 份内容 JSON/Schema 均与 HEAD 原文件逐字一致。

宗门内容追加批次：五宗门数据、编译内容与注册表进入 `game-content/sects`，玩家构筑编译和经脉选择进入 `game-rules/sects`；注册表初始化继续执行原内容校验。30 个既有测试随所属包移动，测试总数未减少。该批再次通过 lint、16 项类型任务、237 文件/2,398 项测试及 9 项强制构建。剩余 shared 跨协议测试未通过放宽底层包依赖强行迁入。

战斗模型追加批次：自动策略、单位展示、回放时间线、遭遇快照及宗门动作模型进入 game-domain；训练/回放/Redis 运行协议进入 contracts；宗门进阶计算进入 game-rules。契约不再通过旧引擎实现取这些类型，依赖图没有增加反向边。该批通过 frozen install、lint（11,076 个导入）、16 项类型任务、237 文件/2,398 项测试及 9 项强制构建。重新生成独立生产依赖目录 `/tmp/daoyou-monorepo-api-combat-models-20261004`，474 个公开 package exports 全部可加载，产物不含 Web workspace 或 API 源码。Docker 容器、API 启停和浏览器流程仍待后续验收。

人物投影与自动战斗批次：52 个文件迁入所属包，包括炼体配置/规则、人物投影、训练/野外遭遇、自动策略与战斗展示。命令模型与 HTTP round/revision 请求信封分离，战斗日志不再依赖 HTTP 会话 DTO。7 份 JSON/Schema 资产与 HEAD 逐字一致。该批通过 lint（11,088 个导入）、16 项类型任务、237 文件/2,398 项测试及 9 项强制构建。

蜃楼与玩法战斗批次：蜃楼祝福/阵容/敌人目录归入 game-content，快照、策略、预览与奖励模型归入 game-domain，生成/完整内容校验/战斗执行归入 game-rules。管理协议使用显式 `CompiledTowerEncounter`，不再通过规则函数的 ReturnType 反向依赖实现。通用战斗输入与恢复状态、突破/宗门/秘境/天骄榜模型独立；对应玩法执行迁入规则包。资源参数规范化函数移入领域资源工具，不改变序列化行为。内容 ID 类型由领域拥有，数值表通过 satisfies 保证完整；没有放宽未知引用、关系循环、预算份额或领奖一致性校验。

本批 65 个既有纯逻辑测试随玩法移动，另两份跨协议/未迁移规则测试保留在 shared，不放宽底层包依赖以迁就测试。搬迁的 8 份 JSON 配置/人物投影基线与 HEAD 逐字一致。6 份配置 README 随内容归位，领域技能更新真实入口。本批通过 lint（11,161 个导入）、16 项类型任务、237 文件/2,398 项测试和 9 项强制构建；Vite 的大 chunk 提示仍存在。

蜃楼检查点的产物验证：frozen install 通过；删除 9 个 workspace 的旧 dist 后重新完成 9 项构建，生成独立生产目录 `/tmp/daoyou-monorepo-api-tower-20261004`。521 个公开 package exports 全部可加载，产物不含 Web 包或 workspace 源码。该目录早于后续讨伐与地图批次，不作为最终运行验收结果。

讨伐与地图批次：地图节点模型、组队模型、讨伐事件和奖励快照归入 game-domain；地图 JSON/查询、难度表、Boss 及技能配置归入 game-content；地图难度、讨伐日程/组队/战斗/结算、排名变化规则归入 game-rules。竞技及讨伐协议进入 contracts。NPC 行动只接收 BattleState，不再通过 Arena HTTP/Redis 协议取类型；奖励快照构造器继续绑定完整 ItemGrantSchema。地图 JSON 与 HEAD 逐字一致。本批通过 lint（11,209 个导入）、16 项类型任务、237 文件/2,398 项测试及 9 项强制构建。

贸易与野外协议批次：邮件附件、拍卖模型、灵兽转移预览、掉落池、野外状态与奖励选择模型归入 game-domain；完整内容校验继续由构造器接收权威依赖，game-rules 绑定当前物品/灵兽规则，contracts 只保留输入输出协议。管理商店、赞助和系统邮件的模型、内容默认值与计算分离。本批通过 lint（11,325 个导入）、16 项类型任务、237 文件/2,398 项测试及 9 项强制构建。

炼丹、背包、修炼与奖励批次：丹药品质/药蕴/修为表、材料价格/预设、灵田配置和奖励 JSON 归入 game-content；评分、堆叠、回收报价、状态恢复、修炼、市场抽样和各玩法发奖计算归入 game-rules。`d3-format` 的直接运行依赖随修炼计算移入规则包，并从 shared 删除。排序/回收测试按协议和玩法分开，保留全部断言。剧情/教学/演出模型与校验归入 game-domain，目录归入 game-content，推进与抽取归入 game-rules；章节 Schema 保留教学存在、链接匹配与奖励唯一性等完整校验。35 份迁移 JSON 与 HEAD 原文件逐字一致。本批 frozen install、lint（11,348 个导入）、16 项类型任务、239 文件/2,398 项测试及 9 项强制构建通过。

宗门组织批次：通用组织接口、展示模型、战斗目标快照归入 game-domain；五宗身份、主题、静态定义及标准展示归入 game-content；准入、任务、经营、奖励计算、注册及生产组合归入 game-rules/sect-organization。原宗门架构守卫跟随规则移动，继续禁止通用核心引用具体宗门，并检查独立内容目录。迁移脚本曾因重复路径分隔符漏写目标，已恢复 99 份源文件并对生产执行部分与上批通过验证的 JS 逐文件核对一致；脚本补充路径规范化、源文件/目标检查及迁移前备份后重新执行。该批通过 lint（11,388 个导入）、16 项类型任务、239 文件/2,398 项测试和 9 项强制构建。随后 frozen install、清空全部 workspace 旧 dist 后的 9 项构建通过；独立生产目录 `/tmp/daoyou-monorepo-api-sect-20261004` 的 588 个公开 exports 全部可由 Node 加载，产物不含 workspace 源码或 Web 包。Vite 仍提示大 chunk；本轮 Docker、API 启停和浏览器验收尚未执行。领域/数据技能校验与 `git diff --check` 通过。

资源协议批次：任务、宗门交付/奖励/战斗目标、闭关结果和人物展示模型归入 game-domain；灵气词汇、数值与恢复计算分别归入 domain、content 和 rules。玩家/宗门/任务/闭关/日志/灵田协议及资源 Schema、分页归并、版本游标和失效处理归入 contracts。`createResourceSchemas` 显式接收原完整 ItemGrant 与宗门交付校验，由 API/Web 各自在 `src/lib/resources/schemas.ts` 绑定，不增加 contracts→rules/content 依赖。背包协议继续使用原先的结构字段投影，领域写入仍保留完整 refinement；没有把背包 wire Schema 描述为完整物品校验。新回归检查确认配置的任务数量上下界和装备校验能够传到资源快照与变更事件。协议测试使用独立领域夹具，测试辅助文件从生产编译排除。该批 lint（11,454 个导入）、16 项类型任务、239 文件/2,400 项测试通过；清空全部九个 workspace 的 dist 后完成九项强制构建。Vite 的 Phaser 大 chunk 提示仍存在；Docker、API 启停和浏览器验收保持待办。

资源批次产物检查：`pnpm install --frozen-lockfile` 与 `pnpm --filter @daoyou/api deploy --prod /tmp/daoyou-monorepo-api-resources-20261004` 通过。在该独立生产目录内，Node 成功按包名加载 599 个公开 exports，并初始化 API 的 21 个资源主题校验；目录中没有 workspace 源码、Web 包或新增协议测试夹具。领域/后端技能校验及 `git diff --check` 通过。独立包解析不替代 API 启动、Docker 或浏览器验收。

领域事件与物品展示批次：历史物品库、邮件附件、事件数据与物品展示模型进入 game-domain；实际附件/事件内容校验、物品库奖励投影和炼丹/铸造展示进入 game-rules；物品库管理输入、NATS subject/version/信封、世界聊天与实时协议进入 contracts。API 在 `lib/mq/domainEventSchema.ts` 组合信封解析与完整规则校验。八份已无过渡依赖的测试随所属包移动，混合测试分离且保留断言；新增事件 refinement 传递回归检查。本批 lint、16 项类型任务及 241 文件/2,401 项测试通过。

功法与秘境批次：功法命令、悟道/阵纹预览、旧功法/道装补偿模型归入 game-domain；悟道、阵纹和补偿数值表归入 game-content；执行规则归入 game-rules，悟道/阵纹请求归入 contracts。秘境材料选择、奖励与运行状态模型归入 game-domain；费用/结算配置和计算分别进入 content/rules。结算 Schema 构造器继续接收完整 ItemGrantSchema；原协议不额外校验奖励 definitionId 的目录存在性，物品入库校验仍由既有规则负责。对照 HEAD 的 41 个规则函数编译后函数体一致。原混合协议断言单独归位，新秘境回归检查覆盖数量、嵌套事实及注入 refinement；首轮新测试误把目录校验视作 ItemGrantSchema 职责，核实并修正测试后全量通过。当前通过 frozen install、lint（11,550 个导入）、16 项类型任务、246 文件/2,404 项测试。干净构建及独立产物验证另行记录。

功法与秘境批次产物检查：清空九个 workspace 的 dist 后完成九项强制构建，生成独立生产目录 `/tmp/daoyou-monorepo-api-domain-tail-20261004`。Node 按包名成功加载 620 个公开 exports，并初始化 API 的 21 个资源主题与领域事件解析绑定；产物不含 workspace 源码、Web 包或协议测试夹具。领域/后端技能校验和 `git diff --check` 通过。Vite 的 Phaser 大 chunk 提示仍存在；Docker、API 启停与浏览器验收尚未执行。

配置与协议收口批次：符箓/社交/市场数值、身份题库、卦象与签文归入 game-content；文本过滤、求签模型、日志变化和讨伐事件 ID 归入 game-domain；选题、求签奖励、签文抽取和日志归并进入 game-rules。求签模型以稳定 ID 和独立展示字段表示，不通过内容文案的字面量类型反向引用内容包。LLM BYOK/路由配置解析、爱发电协议、管理设置输入及开发工具请求进入 contracts；网络调用仍属于 API。纯本地开发工具开放策略在 contracts/dev-tools-access，实际环境读取和执行检查继续由 API 负责。数据库设置键与服务端 QQ 默认值归入 API 私有配置，没有放进全局 constants。contracts 编译环境补充跨 Node/浏览器的 WHATWG URL 类型，不引入 Node 运行依赖。

开发工具 Schema 构造器由 API 的 `dev-tools/dev-tools-input.ts` 绑定当前感悟/灵根上限及奖励/邮件完整校验。类型抽取不降低请求严格度；新增纯校验用例验证上限与灵根总强度依赖传递。其余混合测试拆成协议和玩法两部分；规则包不为测试反向依赖 contracts。34 个本批迁移函数的编译函数体与 HEAD 一致，LLM 路由语法、默认模型、BYOK 校验与粘性选择均保持。该批 frozen install、lint（11,592 个导入）、16 项类型任务、255 文件/2,407 项测试通过。

配置与协议批次产物检查：再次清空九个 workspace 的 dist 并完成九项强制构建；独立生产目录 `/tmp/daoyou-monorepo-api-protocol-tail-20261004` 的 628 个公开 exports 均可按包名加载。API 的 21 个资源主题、领域事件解析器和两份开发工具请求校验成功初始化；目录不含 workspace 源码、Web 包或协议测试夹具。Vite 仍有 Phaser 大 chunk 提示。技能校验和 `git diff --check` 通过；Docker、API 启停与浏览器验收保持开放。

### 八工作区收口与最终静态验收

竞技快照、运行模型与持久回放归档进入 game-domain；竞技模拟、可见性过滤与回放投影进入 game-rules；HTTP/WS/MQ 元数据保留在 contracts。API 的 `combat/arena-view.ts` 为快照和缓存回合结果补回原版本字段。全部原断言保留，协议断言迁入 contracts，竞技/回放针对性 3 文件/30 项检查通过。

删除 shared 后，`pnpm install --frozen-lockfile`、`pnpm run typecheck`（14 项任务）、`pnpm run lint`、`pnpm run test`（256 文件/2,409 项）通过。清除八个 workspace 的旧 dist 后，`pnpm exec turbo run build --force` 完成 8 项构建。独立目录 `/tmp/daoyou-monorepo-api-six-packages-20261004` 中 630 个公开导出均可按包名加载，21 个资源主题、领域事件解析、开发工具 Schema 和竞技 API 适配均可初始化；产物不含 shared、Web、workspace 源码或资源协议测试辅助文件。

应用边界核对：Market 使用角色查询 Provider 和背包回收入口；Auction/Mail 在 Module 中组合依赖，跨领域邮件投递要求显式事务；Player 协调器复用同一实例；Runtime 管理任务与消息启停。仓储没有反向导入 application，数据库/Redis 客户端保持单一入口。并未将每个 Nest feature 拆成 workspace，也未为无状态函数新增包装 Provider。

Web 的请求入口为 apiFetch，资源定义/缓存/订阅归属 lib/resources，路由负责装配页面与布局。发现秘境公共 Hook 从页面私有组件取回调类型，已将类型移入 `lib/hooks/dungeon/types.ts`，三个调用方改为向内依赖；ESLint 新增公共 lib/components/providers 不导入 routes 的限制。该收口后 lint（8 个 workspace、11,609 个导入）与 Web 类型编译/构建再次通过。

Docker 本地镜像 `daoyou-monorepo-review:local` 构建通过，以非 root 用户 1000 运行；容器内六个库、竞技规则和 API 适配可正常解析，没有 shared/Web/API 源码。镜像使用本地专用数据库、Redis、NATS 启动后，健康检查四项均 up。未推送镜像或执行数据迁移。构建仍提示 Phaser 单 chunk 约 1.37 MB（gzip 约 358 kB），属于后续性能优化项。


### 本轮本地运行验收（2026-10-04）

| 验收范围 | 实际结果 |
| --- | --- |
| API 与认证边界 | 编译产物启动成功；无 Cookie 的 `/api/player/resources?keys=session` 返回 401；浏览器既有本地道友 2 会话可读取资源 |
| 启停与交付 | 宿主 API 的 SIGTERM 日志依次显示停止调度、排空请求、停止消息、关闭数据库/Redis及 shutdown complete；随后 Docker 镜像接替同一本地端口，四项健康检查全 up；容器 SIGTERM 正常退出 0 |
| 生产配置保护 | 使用本地镜像且 `--network none` 检查缺失 Redis 的 production 配置，明确在启动前拒绝；没有连接外部环境 |
| SPA 与懒加载 | 洞府、角色、背包、宗门舆图、灵田及 HUD 炼体详情正常显示；背包直接刷新后恢复 34/40 格及原物品 |
| 实时恢复 | 主动停 API 时出现预期代理 502 / WS 重连；Docker API 启动后请求恢复 200、WS 握手恢复 101，页面显示“实时功能连接已恢复” |
| 回放 | 真实历史竞技战绩 `13094a0b-34fd-443b-9cfb-e11c50b9b926` 正常加载；逐行动从 0/69 到 1/69，跳转第 18 回合后推进至 69/69，终局与敌方百分比展示正常 |
| 训练 | 通过真实页面开启单体木桩训练，人物/灵兽防御指令推进到第 2 回合；随后正式放弃并返回准备页。训练后的角色仍为气血 996、法力 900、灵石 42870、背包 34/40，没有遗留活动训练 |
| 响应式 | 360×800 背包视口下 document/body 宽均为 360，截图确认 HUD、物品网格及底部导航正常；已恢复默认视口 |
| 错误观察 | 最终刷新后的浏览器 error 日志为空；服务端未观察到启动或请求异常。停机期间的预期 502 不计作迁移失败 |

本次使用已有本地账号/角色，没有发放物资、修改角色准备数据、执行迁移或对外发消息。临时 API、Web 与验收容器已关闭，本地 PostgreSQL/Redis/NATS/Mailpit 保持原状。截图保存在 `/tmp/daoyou-monorepo-mobile-acceptance.jpg`；构建、测试、部署目录和容器日志分别为 `/tmp/daoyou-six-packages-*.log`，前端收口检查为 `/tmp/daoyou-final-app-*.log`。七份修改技能的 quick_validate 与 `git diff --check` 通过，原有两份暂存文件保持原样。

六包结构迁移及上述本地回归已完成。没有将本次抽样回归描述为所有玩法验收：新登录/自然续期、多玩家新竞技胜利结算、真实目标环境的维护发布与回滚未在本轮重跑；历史道装迁移仍在已排除范围。它们继续属于业务/发布验收，不能由本地结构通过替代。

### 结构迁移后的废弃代码下线（2026-10-04）

本批从干净的 `c6f68d33`（结构优化）开始，按用户追加要求审查并下线过时代码。六包迁移的历史验收数据保留在上文；本节记录清理后的实际结果。唯一删除的 HTTP 路由是 `/api/dungeon/limit`，其余改动为无消费者代码退役、兼容调用迁移和测试辅助产物隔离。

审查以 API/Web 启动入口和维护脚本为根，解析静态导入、再导出、字面量动态导入及内联类型导入，并按 workspace exports 还原到源码；随后核对全仓符号引用、Nest 模块/路由及当前业务替代路径。初次扫描 2,047 个 TS/TSX 文件，生产入口不可达候选 33 个；不可达或名称含 legacy 本身均不作为删除依据。清理后扫描 2,016 个文件，生产入口可达 1,755 个，剩余 5 个非测试文件候选均为被测试使用的辅助文件。该静态检查不证明所有导出成员、外部消费者或历史数据都已没有用途。

| 下线范围 | 依据与当前路径 |
| --- | --- |
| 秘境每日次数接口、Redis limiter、Web Hook | Web Hook 没有消费者，次数扣除函数没有调用；现有开始流程由 `QiService` 的 `dungeon_start` 灵气预留控制。删除接口后返回 404，不再提供失效的每日两次信息；没有清空 Redis 数据 |
| 旧秘境奖励表、结算 policy、LLM 奖励 Schema/上下文及修为工具 | 当前奖励由 `dungeon/application/flow/rewards.ts` 与 `game-rules/rewards/dungeon` 确定性计算，结尾生成器只提供叙事与评级；旧实现没有生产消费者 |
| Web 孤立组件与过渡层 | 删除旧 StatusCard、PersistentStatusesCard、秘境进度/费用卡、TypewriterText、InkPageShell、gameShellRegistry、旧 inventory 资源入口；实际路由嵌套与现有资源存储保持。InkCard 唯一旧 `highlighted` 调用改为等价的 `variant="highlighted"` |
| 领域/规则兼容入口 | 删除无消费者的 dictionaries、tags 及若干 barrel/别名；角色生成从旧包装器直接调用 `CharacterGenerator.generate`，参数和返回值保持 |
| API 无调用成员 | 删除 7 个旧资产仓储包装/扣除函数、Market/在线状态旧测试钩子、废弃 SectPermission 别名及恒为 false 的秘境刷新辅助函数；仍被调用的事务入口保留 |
| 测试辅助产物 | 保留 5 份被测试引用的夹具/辅助源码，撤销其中 3 个包导出，并从生产编译排除。结算完整校验回归测试保留，在测试内组合 Schema |

共删除 31 个文件及 13 个公开子路径导出；13 个导出中有 3 个属于仍保留源码的测试辅助文件。删除的 `settlementPolicy.test.ts` 仅覆盖同期退役的旧策略，因此测试从 256 文件/2,409 项降为 255 文件/2,401 项，现行奖励与校验测试仍保留。

明确保留：洞府旧储藏室、功法/道装兑换及其读写链路、仍被调用的旧资产事务函数和数据库表；历史物品 `quality_hint`、炼丹 `yieldQuantity` / `secondaryEffectMultiplierBonus`、待处理消息兼容分支及历史资源文件。这些仍涉及在线入口或存量事实，不能随目录改造删除。表级退役继续参照 [旧表退役记录](combat-v6-legacy-table-retirement.md)，本批没有执行数据库迁移、删表或资产数据清理。

本批验证：

- `pnpm install --frozen-lockfile`、`pnpm run lint`（8 个 workspace、11,505 个导入）、`pnpm run typecheck`（14 个 Turbo 任务及根工具类型检查）全部通过。
- `pnpm run test`：255 个文件、2,401 项全部通过。清除八个 workspace 的旧 dist 后，`pnpm exec turbo run build --force` 完成 8 项构建；Phaser 大 chunk 提示仍存在。
- `pnpm --filter @daoyou/api deploy --prod /tmp/daoyou-retirement-api-20261004` 成功；独立生产目录内 617 个公开 exports（含 JSON）均可加载，21 个资源主题、领域事件、开发工具 Schema 和竞技 API 适配可初始化。删除文件对应的 JS/声明/映射以及 5 份测试辅助文件均未进入产物；没有 shared、Web 包或 workspace 源码。
- 本地编译 API 启动成功，health-check 的数据库、Redis、NATS 和消息状态全 up；已移除的 `/api/dungeon/limit` 返回 404。浏览器既有本地道友 2 会话下，秘境准备页正常显示，背包保留 34/40 格及既有物品，未观察到浏览器 error 日志。
- 寄魂庐页面显示既有身份权限门槛，未进入内部卡片；`highlighted` 调用迁移只完成静态等价核对及编译检查，不记作该卡片的视觉验收。没有执行新角色 LLM 生成、新秘境结算、兑换写入、完整玩法回归或生产/预发布验收；本轮未重建 Docker 镜像，独立生产目录验证不替代容器验收。
- 游戏 UI 技能 quick_validate 与 `git diff --check` 通过；同步修正 AGENTS、UI 技能及布局所有权文档中的已删除入口。

本批未提交、推送或部署。临时浏览器、API 和 Web 已关闭；API SIGTERM 日志确认请求排空、消息停止、数据库/Redis 关闭及 shutdown complete，本地基础服务保持原状。构建、测试和运行日志保存在 `/tmp/daoyou-retirement-*.log`；静态审查工具只用于本地检查，未新增仓库测试脚本。

### 后续演进的边界

当前目标稳定在两应用、六库。constants 只收稳定词汇；数值和目录继续进入 game-content，领域事实进入 game-domain，执行计算进入 game-rules，HTTP/实时信封进入 contracts。服务端环境、数据库设置键及供应商连接配置由 API 自己拥有。禁止重新建立聚合 shared/utils 来回收这些职责。

继续改进的顺序为：先完成配套发布验收；再根据实际加载分析优化 Phaser 入口和体积；日常按具体业务收窄公开子路径和跨 feature 入口。仅当出现第二个真实 UI 消费者或独立 worker 部署单元时，再讨论 ui/api-client/server-infra 包。单纯增加目录或把所有常量搬到同一处不作为进一步拆包的依据。

## 依赖与所有权

- 保留 `apps/api`、`apps/web` 及本页列出的六个库，共八个工作区。两个应用独立构建，在停机维护窗口内配套发布；应用之间通过 HTTP/SSE/WS 通信，不相互导入。
- Controller 处理身份、输入与响应；应用层组织业务流程；repository 负责存储和映射；六个内部库分别承担词汇、模型、内核、内容、计算和协议。
- 跨领域使用职责明确的公开入口，不建立导出整个 feature 的聚合 barrel。需要长期存在或组合外部依赖的应用对象由 Module/Provider 或明确的生产组合入口管理；无状态计算保留普通函数。
- 玩家状态协调属于 `player/application/state`，负责命令、事务、幂等、资源版本与提交响应。角色、战斗等领域仍拥有各自规则，通过窄入口供协调器调用。
- `lib` 保留数据库、Redis、NATS、认证、LLM 等共享技术设施。具体秘境/蜃楼玩法归属对应 feature；业务消息处理器注册归属 Runtime 组合层。
- repository 不调用应用服务；写路径必须传递同一个 `DbExecutor`/`DbTransaction`，不在事务中回退到全局客户端。

## 提交顺序

1. 解析身份与请求，执行角色/玩法锁和权限校验。
2. 在原有事务内执行必要资格检查、资产写入、角色资源刷新、日志及资源版本提交。
3. 需要可靠交付的事件在事务内写入现有 outbox，发布/消费沿用原有恢复与去重机制。
4. 提交后通知浏览器；失败通过资源补读或已有消息恢复路径处理。

不把同步一致性规则改成异步事件，不改变锁、CAS、幂等键、消息确认或停机排空顺序。

## 前轮应用迁移批次与验收（历史）

| 批次 | 范围 | 验收 |
| --- | --- | --- |
| 1 | 固定边界与基线 | 当前 lint/typecheck/build/shared 测试结果明确 |
| 2 | 坊市购买与回收样板 | Provider 依赖可见；正常/失败/重复请求保持原协议与资源提交 |
| 3 | 玩家状态协调层归位 | 全部调用方迁移；事务与同步刷新顺序保持 |
| 4 | 秘境/蜃楼归位、应用对象与消息组合 | 无旧导入；启动、readiness、停机及受影响流程验证 |
| 5 | shared 公开入口与 SPA 路由/HUD | 包解析通过；路由路径/顺序/布局/场景 metadata 保持，360px 与桌面核对 |
| 6 | 发布质量与版本追溯 | tag 发布依赖同 revision 的质量检查；镜像 revision/digest 可追溯，记录前端 build ID |

每批仅改变结构和依赖，协议、游戏规则、数据库模型的变化另列任务。Lint、类型检查、构建、静态依赖审查是共同基线；运行验证使用 `docs/testing.md` 的真实本地流程，不新增服务 mock 或临时测试脚本。

## 公共包与前端

契约、领域规则、展示计算和历史迁移辅助按本页依赖图归属对应包；新增公开能力需声明 exports，宿主不绕过包入口。核心引擎保持确定性，历史便捷函数的默认随机/时钟行为不代表战斗核心协议。

前端 router 统一组装领域路由定义；定义保留 lazy 导入、稳定 route id、scene/title 和原始嵌套顺序。HUD 展示与详情交互分别拥有职责，继续复用 ResourceStore/apiFetch。

## 停机维护与配套发布

2026-10-04 用户确认：发布时停机维护，SPA 与 API 配套更新。旧 SPA 与新 API 的交叉版本兼容不作为设计或验收要求，契约变更可在同一发布中同步修改两端。

维护窗口内先停止新请求和后台任务，按现有顺序排空 HTTP 与消息处理，再更新配套 API、SPA 和必要的数据变更。记录 API revision、不可变镜像 tag/digest 和 SPA build ID；在恢复入口前验证健康检查、认证、实时连接及资源协议。恢复后要求页面重新加载当前 SPA，避免继续使用维护前已打开的页面。

回滚以配套 API 与 SPA 为单位；若涉及数据变更，须同时确认旧版本可读取更新后的数据，或准备相应数据恢复方案。镜像回滚不能撤销数据迁移，停机也不会自动清空 Redis 活动状态或 NATS 待处理消息，需在有相关协议变更时单独检查。

历史道装数据迁移按用户要求从后续改造范围排除。自然会话续期、多人胜利结算和真实目标环境的维护发布／回滚仍需验收；本地构建和结构迁移不替代这些证据。

## 实施状态

六个批次的代码与配置已于 2026-10-03 落地。完整检查、真实本地流程、失败/重放与目标环境的未验证项见 [架构记录第 7 节](monorepo-architecture.md#7-后续六阶段实施与验收记录)。代码完成和生产发布验收分别记录：本轮没有提交、推送、数据库迁移或生产部署。

2026-10-04 追加完成拍卖／邮件应用对象 DI、邮件事务投递入口、秘境存储与结尾生成拆分，以及 Runtime 注入任务映射。公开背包操作保留显式事务的函数入口，Redis 与 Player Provider 复用既有单例。新增拍卖／邮件私有实现导入约束。本轮实测、结构完成条件与停机发布清单见 [架构记录第 11 节](monorepo-architecture.md#11-拍卖邮件秘境与-runtime-依赖收口)。生产发布和未覆盖业务验收单独保持开放。
