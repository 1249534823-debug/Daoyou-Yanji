# 万界道友•衍极界 · 原生安卓客户端

这是使用 Android 原生 View、Java 17 和 OkHttp 开发的客户端，不嵌入 WebView。
连接固定的 `https://daoyou.yanji.sbs`，账号、角色与资产由现有服务器统一管理。
当前版本为 0.1.0 首版，不能等同于网页全功能替代版。

## 已接入的代码范围

- 邮箱密码、邮箱验证码登录，原有 ALTCHA v2 校验；AndroidKeyStore 加密会话，不存密码。
- 角色资源、功法/属性查看、闭关与突破（SSE 接口）。
- 储物袋分页、法宝装备、丹药使用。
- 天灵秘境配置、探索选项、服务端战斗、恢复与退出。
- 游戏邮件、附件领取、天骄榜只读展示。
- 前台实时资源通知、断线退避重连、切回前台重新读取快照。
- 失败请求不会自动重放写操作。超时后应先刷新确认。

## 尚未迁移

创角、拍卖交易、炼丹与造物、灵田、宗门、世界/好友聊天、其他地图和完整战斗回放，
仍需后续原生开发。当前“传音”页提供游戏邮件，未提供聊天。
HP/MP 存储数据缺失时显示“待同步”，不会伪造满血；精确装备派生上限后续应由服务端展示 DTO 提供。

## 构建

JDK 17，Android SDK platform 35 / build-tools 35.0.0，Gradle 8.11.1，AGP 8.9.2。
最低 Android 8.0（API 26）。

```sh
export ANDROID_HOME=/path/to/android-sdk
gradle --no-daemon :app:assembleDebug :app:assembleRelease :app:lint :app:assembleDebugAndroidTest
```

发布 APK 使用独立长期密钥签名；不要分发调试 APK，勿将签名私钥或密码提交仓库。
同包名升级必须保留原签名和提高 versionCode。仅更换 APK 不涉及数据库迁移或网页部署。
服务器部署与备份继续使用现有项目方案，本工程不修改生产数据库。

```sh
zipalign -p -f 4 app-release-unsigned.apk aligned.apk
apksigner sign --ks /secure/release.jks --ks-pass file:/secure/password --out yanji-native.apk aligned.apk
apksigner verify --verbose --print-certs yanji-native.apk
```

## 验证

`app/src/androidTest` 的独立 instrumentation APK 包含明确测试数据：
PBKDF2 二进制密码对照向量、匿名 API 拒绝检查、登录/角色/闭关/装备详情截图。
这些测试数据不编入发布应用，也不写入服务器。
真实账号登录及有消耗的在线行为需要专用测试账号再验收，不使用运营玩家资产做测试。
验证状态见 `VERIFICATION.md`，未执行的项目不得视为通过。

## 安全与数据

仅申请网络权限；默认拒绝明文传输、跨站重定向、任意服务地址及备份会话。
没有服务器管理员密钥、隐藏账号、绕过验证码的入口或本地加资源逻辑。
所有收益与操作权限均由现有服务端决定。

本客户端对接万界道友派生服务，保留原项目 GPL-3.0 授权与署名，相关声明以主仓库为准。
