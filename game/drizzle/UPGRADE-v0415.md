# 自定义 v0.3.12 → 作者 v0.4.15 数据切换

候选目录 `/data/projects/daoyou-upgrade-v0415`。已发布本地 0000–0039 SQL 和账本前 40 项逐字保留；作者 0034–0060 顺延为本地 0040–0066。来源、哈希、时间映射见 `upstream-v0415-map.json`，新增 0067 仅转换有效普通材料寄售快照。

## 迁移结果与保留规则

- 全部旧 materials / consumables / creation_products 保留；作者宝库及显式法宝/功法焕新继续访问历史资产，不批量兑换、删除或发补偿。V6 当前背包采用新 inventory_items。
- 宗门原始会员、六心法、路径与节点先存入 app_settings 的 `custom-v0415:before:*`。使用作者已标准化的六心法与经脉深度；有证据的九劫路径显式映射，其他路径保持未选择。旧节点原样归档，玩家用已解锁深度选择 V6 节点，不扣新资源。
- 保留全部自定义表、持久购买凭证、贡献邮件、灵石来源账本、天灵、NPC、管理员战力历史。普通材料寄售的 id、所有权、单价、初始/剩余数量、定向条件和过期时间不变。
- 旧道具库及所有商店历史保留。`upgrade-library-snapshots.ts` 生成受当前 RewardItemSchema 校验的冻结 SKU；装备按原质量/境界/部位与条目 ID 的稳定种子走当前官方铸造器，无强化加成。发放时 materializeRewardItem 生成独立实例 ID，购买不重新随机。合法旧名/描述保留，不满足新叙事约束的保留官方生成名；原库文案不改。
- 仅作者退役的 draw_gongfa / draw_skill 两个符箓 SKU 留作 archived，专属原因写入 `custom-v0415:library-snapshots.retired`。作者维护文档明确既有此类符箓暂不转换、不补偿，历史邮件/库存不批量改写。

## 必须先完成的旧版本边界

禁止新旧写入者重叠。先停止新入场/新调度，用旧版本收尾已有天灵/普通副本/战斗，再排空 outbox 和旧 NATS 消费者。只看数据库 published_at 不足够：每个旧 durable consumer 的 num_pending 与 num_ack_pending 都必须为 0；DLQ 要检查，不可删流或重建 durable 位点。`upgrade-runtime-audit.ts` 只读列出这些数量，不调用 topology 或应用 bootstrap。

2026-10-01 盘点：没有人类普通副本、赌战、竞技房、V5 在线战斗及排队/结算/回放任务；仅 NPC 天灵按旧版收尾。3 个人类旧周期宗门任务为 sweep / mining / progress，进度为 0 / 0 / 1，没有运行中的小游戏 session；兼容执行器及冻结数值奖励保留，记录不删除。5 个已完成旧宗门战斗均已领奖。闭关采用同步事务，retreat_records 是完成历史，无排队会话。

V6 战斗 Redis 使用 combat:v6，与旧 battle 前缀隔离。玩家 profile 和背包从数据库读取，没有需要清空的全量 Redis 背包缓存。只可按需精准清理 `active-cultivator:user:*` 和 `auction:listings:*` 投影（SCAN + UNLINK，必须旧写入者停止）。保留 `market:v2:listings:*` / bought 的原货单与限购、golden_rank 排名、session/授权、日限/限流、qi、所有锁及幂等记录。dungeon:battle-result 是已提交操作结果，保留自然 1 小时 TTL；不使用 FLUSHALL/FLUSHDB。

## 已演练命令顺序

运行目录必须为候选根目录。迁移脚本不加载隐式 local.env；数据库名必须显式匹配。以下克隆例使用 512 MiB / 1 CPU，没有 app 进程或 cron。

```bash
docker exec daoyou-upgrade-validation-db-1 pg_dump -U daoyou -d daoyou_validate -Fc > /data/backups/daoyou-upstream-20261001/clone-before-upgrade.dump

docker run --rm --memory=512m --cpus=1 --network daoyou-upgrade-validation_default --env-file /data/projects/daoyou-upgrade-validation/runtime.env -v /data/projects/daoyou-upgrade-v0415:/app:ro -w /app oven/bun:1.3.13 bun drizzle/upgrade-runtime-audit.ts --database daoyou_validate

docker run --rm --memory=512m --cpus=1 --network daoyou-upgrade-validation_default --env-file /data/projects/daoyou-upgrade-validation/runtime.env -v /data/projects/daoyou-upgrade-v0415:/app:ro -w /app oven/bun:1.3.13 bun drizzle/upgrade-migrate.ts --database daoyou_validate

docker run --rm --memory=512m --cpus=1 --network daoyou-upgrade-validation_default --env-file /data/projects/daoyou-upgrade-validation/runtime.env -v /data/projects/daoyou-upgrade-v0415:/app:ro -w /app oven/bun:1.3.13 bun drizzle/upgrade-library-snapshots.ts --database daoyou_validate
```

检查 dry-run 明确列出的 restored / retired / archivedWithoutSnapshot 后，再对同一克隆运行：

```bash
docker run --rm --memory=512m --cpus=1 --network daoyou-upgrade-validation_default --env-file /data/projects/daoyou-upgrade-validation/runtime.env -v /data/projects/daoyou-upgrade-v0415:/app:ro -w /app oven/bun:1.3.13 bun drizzle/upgrade-library-snapshots.ts --database daoyou_validate --apply

docker exec -i daoyou-upgrade-validation-db-1 psql -v ON_ERROR_STOP=1 -U daoyou -d daoyou_validate < /data/projects/daoyou-upgrade-v0415/drizzle/upgrade-v0415-verify.sql
```

然后重复 upgrade-migrate、shop --apply、只读 verify：账本仍 68 条，shop 应返回 already-completed，断言仍通过。只有这时才启动新应用进行业务验收；应用开始合法写入后不再用此严格前后相等断言。

正式切换由主协调执行同一顺序：改为已确认的生产网络 `daoyou_default`、受控环境文件 `/data/projects/daoyou-deploy/.env`、目标 `--database daoyou` 与生产 DB 容器，并先在旧写入者完全停机后取得新鲜全库/Redis/NATS一致备份。本文与工具本身不代表已上线。

任何 SQL/快照/资产断言失败都保持维护，不跳过报错或补写迁移账本。新版本产生写入后不能仅切回旧镜像；先保存故障证据，再按完整一致备份恢复数据库与消息持久状态。

## 克隆证据

日志位于 `/data/backups/daoyou-upstream-20261001/`：

- clone-migrate.log / clone-migrate-repeat.log：Auth + 业务成功，68 项，latest 1790763373539。
- clone-shop-dryrun.json / clone-shop-apply.json：312 个支持 SKU 恢复，2 个明确退役，其他异常 0；clone-shop-repeat.json 为 already-completed。
- clone-assets-verify.log / clone-assets-repeat.log：15 张旧资产/自定义表完整 count+checksum 相同；18 角色、20192864 灵石、2787 材料、1187 消耗品、87 旧创建资产、14 有效寄售；所有角色仅发生作者定义的加点预算增量；宗门映射与商店身份/价格/数量/限额保持。
- legacy-library-catalog-validation.json：真实发布目录 109 装备完整编译、145 当前消耗品通过；2 个退役符箓报告，错误 0。天灵丹 specialEffect + 空 operations 另通过正式 parser/RewardItemSchema 验证。
- clone-runtime-audit.jsonl / production-runtime-readonly-audit.jsonl：只读 Redis/NATS/outbox 盘点；盘点时间后生产仍可能变化，正式停机后必须复查。

## 遗留邮件补充核对

生产与克隆均有 12 封未领取邮件、29 个附件：17 材料（39 件）、2 消耗品（2 件）、3 法宝（3 件）、5 声望（300）、1 灵石（5000）、1 修为（40）；不存在 gongfa/skill 顶层附件（旧版也未定义这两种邮件类型），宗门贡献旧邮件数为 0。

作者保留旧邮件→洞府宝库领取路径；材料/消耗品之后通过宝库取出原子转为 V6 库存，法宝通过显式焕新兑换。材料与丹药的实际全部附件均符合当前取出协议。新奖励使用 inventory_v1，与保留历史邮件事实分开。

发现并修复一处上游兼容回归：旧新手邮件 3 件凡品法宝未带 score，旧版领取时按品质默认 80；新版直接缺省为 0，导致后续作者焕新拒绝。PlayerMailApplicationService 在单封/一键领取仅补回缺失的历史品质评分，原邮件 JSON 不改，有评分法宝不改，未另造奖励或补偿规则。

`unclaimed-mail-validation-after.json`：12 封/29 附件完整解析、29 资源操作，17 材料/2 消耗品可取出、3 法宝可焕新，错误 0。`legacy-mail-claim-regression.log`：克隆内真实资源入库 + 邮件领取标记事务回归，3 法宝均 score80，作者焕新 level10/蓝图0/灵石0，重复标记被拒绝；测试整体回滚，原邮件与资产不变。
