import { envConfig } from "@/lib/config/company";

export default function GoogleOneTapHint() {
  if (!envConfig.googleClientId) {
    return null;
  }

  return (
    <div className="card" data-google-client-id={envConfig.googleClientId}>
      <h3>Google One Tap</h3>
      <p>已偵測 Google Client ID，可在正式 OAuth 設定後把姓名、Email、Google ID 帶入詢價流程。</p>
    </div>
  );
}
