# 灵石收支统计发布说明

## 行为与口径
- 入口：后台 → 玩家管理 → 灵石收支；API仅管理员可访问。
- 按 Asia/Shanghai 自然日、角色独立统计收入、支出和净变化。金额按灵石整数单位显示。
- 余额变动触发器与实际余额更新、流水插入和日汇总处于同一事务，失败一起回滚。
- 同一事务先收入再支出分别累计；未领取邮件不计收入；限额截断只计实际变化。
- 已有余额不是收入，不回填启用前历史。启用首日明确提示非完整一天。
- 当前余额不是历史日终余额。删除角色后保留已有流水和当天姓名快照。
- 无活动的现有角色仍可查询；名称搜索和分页由后端处理。来源未分类的变动显示“其他余额变动”。
- 无新密钥、环境变量、定时任务或外部API依赖。数据库为统计的持久来源。

## 部署
沿用本项目已部署的 Docker Compose / Nginx；不用修改反向代理与域名。
1. 备份数据库（pg_dump自定义格式）、当前dist和output/client；保留原应用镜像。
2. 在独立构建目录复制源码、public、Vite及TypeScript配置，共用只读依赖；执行类型检查、client/server/两个worker构建。禁止在在线dist直接执行server构建。
3. 在单个数据库事务中应用 drizzle/0037_spirit_stone_statistics.sql，并按Drizzle约定将原始SQL SHA-256与_journal.json对应when写入drizzle.__drizzle_migrations。发布程序需检查前一版本0036及目标未应用，防止重复执行。迁移含3秒锁等待上限，超时整体回滚后择时重试。
4. 替换dist与output/client，保留上一版带哈希静态资源供旧页面使用；在/data/projects/daoyou-deploy执行：
   docker compose --env-file .env -f compose.yaml up -d --no-deps --force-recreate app
5. 验证/api/ready全依赖正常，公网/version.json符合本次buildId，后台页面加载成功。
6. 发布记录与验证结果保存在output/spirit-ledger，备份地址记于该目录backup-path.txt。

## 回滚与恢复
- 首选回滚应用和静态目录并重新创建app容器。新表和触发器向后兼容，应保留已有流水，不删除统计数据或覆盖在线玩家数据库。
- 如果触发器本身阻塞余额更新，由维护者评估后可紧急停用wanjiedaoyou_spirit_stone_capture；停用期间会缺记，必须告知统计覆盖存在缺口。恢复前验证问题，再启用，不能伪造缺失流水。
- 全库恢复只用于灾难恢复：先停止所有写入，验证备份，使用pg_restore；不可为了回滚界面而覆盖期间产生的玩家数据。
- 备份包含统计表与触发器；恢复演练应在独立数据库中执行。

## 日常检查
- 沿用/api/ready与Docker健康检查监控数据库、Redis、NATS和工作线程；应用错误在docker logs daoyou-app-1。
- 留意数据库写入延迟、磁盘空间，以及ledger/daily表大小；不自动删除流水。
- 可按日期、角色比较流水SUM正负delta与daily汇总；不一致应报警调查，不能直接改玩家余额。
- 此版本未新增外部告警接收渠道；沿用现有监控配置。
