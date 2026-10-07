# 0.1.0 验证记录

## 已确认

- 2026-09-12：Java17 / Gradle8.11.1 / AGP8.9.2 / SDK35 编译。
- 最终 build4：assembleDebug、assembleRelease、lint、assembleDebugAndroidTest 全部成功；106任务，21执行、85复用。
- 首轮API26导航栏样式NewApi错误已修复；没有创建lint基线掩盖错误。
- 发布APK只申请 INTERNET 权限；minSdk26，targetSdk35；原生Activity，没有WebView。
- 发布APK不含SmokeInstrumentation或测试角色字符串；ZIP完整性通过。
- v2/v3 APK签名校验通过，RSA3072；长期签名私钥仅留在服务器私有构建目录。
- APK SHA256：0b03808097b05dcd30c1a05b80ed2bd65f3c5500eb50dbadf128e3a1b075b0fa。
- 文件大小：1,058,295字节。
- 真实线上只读检查：匿名get-session返回null，私有角色资源返回401。
- Android29软件模拟器中调试APK安装成功，应用实际启动。
- 390×844、430×932、768×1024 instrumentation分别输出PASS 7断言。
  相同断言重复运行，不应宣称21项独立业务测试。
  覆盖PBKDF2原始二进制密码对照向量、匿名会话、未授权资源拒绝与4张原生截图生成。

## 未通过/未完成的验收

- 390及430截图被模拟器“System UI isn't responding”弹窗遮挡。虽脚本通过，视觉验收不能算通过。
- 模拟器无KVM硬件加速；多次在1.8GiB/3GiB容器上限内被OOM终止。关闭Vulkan后仍未稳定完成全流程。
- 1440×900未取得完整通过记录；四尺寸视觉验收未完成。
- 未获得专用真人测试账号，未执行真实登录、实际角色闭关/装备/秘境/邮件领取的端到端写操作。
- 尚未在实体安卓手机安装验收；发布签名APK尚未单独完成启动验收，已运行的是同源调试APK。
- 不能称为正式运营发布版或全量网页替代版；当前交付原生测试首版。

## 文件与运行环境

源码保存在主仓库android-native目录；release APK在releases目录。
原始日志 /data/build-tools/yanji-android/build4.log、signature.log、smoke-final.log、smoke-sizes.log。
测试截图与各尺寸日志保存在android-native/test-evidence。
测试数据只在独立androidTest构建内，不会写入生产，也不编入发布APK。
服务器业务配置与生产数据库未修改。

## 下一轮明确待办

1. 在可用的硬件加速模拟器/实体安卓机完成视觉、键盘、返回键与登录恢复验收。
2. 使用专用账号验证真实认证与闭关、装备、用药、完整秘境和邮件附件链路。
3. 对齐概念图的背包网格、物品图标和更多细节。
4. 逐步迁移创角、拍卖、宗门、聊天等README列明的剩余玩法。
