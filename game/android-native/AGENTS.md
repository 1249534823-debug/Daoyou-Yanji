# Android native client

- Pure Android native UI. Do not replace screens with WebView without explicit user approval.
- Reuse existing server contracts and authentication, never reimplement authoritative game economy locally.
- Fixed HTTPS origin only; no secret/API key/admin credential in APK. Persistent opaque cookies use AndroidKeyStore AES-GCM.
- Existing backend mutations are not automatically retried. Read server state after uncertain network outcomes.
- Build with Java17, Gradle8.11.1, AGP8.9.2, SDK35. Minimum API26.
- Keep release signing materials outside this repository and never replace the release key.
- Test fixtures only under androidTest; never add test account secrets, fixture modes or authentication bypasses to release code.
- Capture actual emulator/device UI for layout verification. Report untested real-account flows explicitly.
- Maintain README and VERIFICATION scope accurately; this first version is not full web feature parity.
