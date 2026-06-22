"use client";

import { useEffect, useState } from "react";
import styles from "./SocialDistribute.module.css";

interface GeneratedItem {
  platform: string;
  label: string;
  caption: string;
  autoPost: boolean;
  imageUrl: string | null;
  imageDataUrl: string | null;
}

interface SocialConnectionState {
  line: boolean;
  facebook: boolean;
  instagram: boolean;
  x: boolean;
}

interface SocialDistributeProps {
  connections: SocialConnectionState;
}

interface SocialProfile {
  id: string;
  platform: string;
  name: string;
  loginId?: string;
  note?: string;
  passwordManager?: string;
}

const SOCIAL_ACCOUNTS = [
  {
    id: "line",
    shortLabel: "LINE",
    label: "LINE 官方帳號",
    mode: "connected",
    createUrl: "https://manager.line.biz/",
    loginUrl: "https://manager.line.biz/",
  },
  {
    id: "facebook",
    shortLabel: "f",
    label: "Facebook 粉專",
    mode: "oauth",
    createUrl: "https://business.facebook.com/pages/create/",
    loginUrl: "https://www.facebook.com/login/",
  },
  {
    id: "instagram",
    shortLabel: "IG",
    label: "Instagram 商業帳號",
    mode: "oauth",
    createUrl: "https://www.instagram.com/accounts/emailsignup/",
    loginUrl: "https://www.instagram.com/accounts/login/",
  },
  {
    id: "x",
    shortLabel: "X",
    label: "X 帳號",
    mode: "oauth",
    createUrl: "https://x.com/i/flow/signup",
    loginUrl: "https://x.com/i/flow/login",
  },
  {
    id: "tiktok",
    shortLabel: "♪",
    label: "TikTok",
    mode: "manual",
    createUrl: "https://www.tiktok.com/signup",
    loginUrl: "https://www.tiktok.com/login",
  },
  {
    id: "xiaohongshu",
    shortLabel: "RED",
    label: "小紅書",
    mode: "manual",
    createUrl: "https://www.xiaohongshu.com/explore",
    loginUrl: "https://www.xiaohongshu.com/explore",
  },
  {
    id: "youtube",
    shortLabel: "YT",
    label: "YouTube／Shorts",
    mode: "manual",
    createUrl: "https://www.youtube.com/create_channel",
    loginUrl: "https://accounts.google.com/ServiceLogin?service=youtube",
  },
  {
    id: "threads",
    shortLabel: "@",
    label: "Threads",
    mode: "manual",
    createUrl: "https://www.threads.com/",
    loginUrl: "https://www.threads.com/login",
  },
  {
    id: "google_business",
    shortLabel: "G",
    label: "Google 商家檔案",
    mode: "manual",
    createUrl: "https://business.google.com/create",
    loginUrl: "https://business.google.com/",
  },
  {
    id: "linkedin",
    shortLabel: "in",
    label: "LinkedIn 公司專頁",
    mode: "manual",
    createUrl: "https://www.linkedin.com/company/setup/new/",
    loginUrl: "https://www.linkedin.com/login",
  },
  {
    id: "dcard",
    shortLabel: "D",
    label: "Dcard",
    mode: "manual",
    createUrl: "https://www.dcard.tw/signup",
    loginUrl: "https://www.dcard.tw/login",
  },
  {
    id: "pinterest",
    shortLabel: "P",
    label: "Pinterest",
    mode: "manual",
    createUrl: "https://www.pinterest.com/business/create/",
    loginUrl: "https://www.pinterest.com/login/",
  },
  {
    id: "telegram",
    shortLabel: "TG",
    label: "Telegram 頻道",
    mode: "manual",
    createUrl: "https://web.telegram.org/",
    loginUrl: "https://web.telegram.org/",
  },
  {
    id: "whatsapp",
    shortLabel: "WA",
    label: "WhatsApp Business",
    mode: "manual",
    createUrl: "https://www.whatsapp.com/business/",
    loginUrl: "https://web.whatsapp.com/",
  },
  {
    id: "wechat_official",
    shortLabel: "微",
    label: "微信公眾號",
    mode: "manual",
    createUrl: "https://mp.weixin.qq.com/",
    loginUrl: "https://mp.weixin.qq.com/",
  },
  {
    id: "wechat_channels",
    shortLabel: "視",
    label: "微信視頻號",
    mode: "manual",
    createUrl: "https://channels.weixin.qq.com/",
    loginUrl: "https://channels.weixin.qq.com/",
  },
  {
    id: "weibo",
    shortLabel: "博",
    label: "新浪微博",
    mode: "manual",
    createUrl: "https://weibo.com/signup/mobile.php",
    loginUrl: "https://weibo.com/",
  },
  {
    id: "douyin",
    shortLabel: "抖",
    label: "抖音",
    mode: "manual",
    createUrl: "https://www.douyin.com/",
    loginUrl: "https://www.douyin.com/",
  },
  {
    id: "kuaishou",
    shortLabel: "快",
    label: "快手",
    mode: "manual",
    createUrl: "https://www.kuaishou.com/",
    loginUrl: "https://www.kuaishou.com/",
  },
  {
    id: "bilibili",
    shortLabel: "B",
    label: "嗶哩嗶哩 B站",
    mode: "manual",
    createUrl: "https://www.bilibili.com/",
    loginUrl: "https://passport.bilibili.com/login",
  },
  {
    id: "zhihu",
    shortLabel: "知",
    label: "知乎／機構號",
    mode: "manual",
    createUrl: "https://www.zhihu.com/org/signup",
    loginUrl: "https://www.zhihu.com/signin",
  },
  {
    id: "toutiao",
    shortLabel: "頭",
    label: "今日頭條",
    mode: "manual",
    createUrl: "https://mp.toutiao.com/",
    loginUrl: "https://mp.toutiao.com/",
  },
  {
    id: "baijiahao",
    shortLabel: "百",
    label: "百度百家號",
    mode: "manual",
    createUrl: "https://baijiahao.baidu.com/",
    loginUrl: "https://baijiahao.baidu.com/",
  },
  {
    id: "qzone",
    shortLabel: "Q",
    label: "QQ／QQ空間",
    mode: "manual",
    createUrl: "https://im.qq.com/",
    loginUrl: "https://qzone.qq.com/",
  },
  {
    id: "lemon8",
    shortLabel: "L8",
    label: "Lemon8",
    mode: "manual",
    createUrl: "https://www.lemon8-app.com/",
    loginUrl: "https://www.lemon8-app.com/",
  },
] as const;

const RECOMMENDED_SETUP_IDS = [
  "line",
  "facebook",
  "instagram",
  "google_business",
  "youtube",
  "threads",
  "tiktok",
  "wechat_official",
  "weibo",
  "xiaohongshu",
];

export default function SocialDistribute({ connections }: SocialDistributeProps) {
  const [authChecked, setAuthChecked] = useState(false);
  const [text, setText] = useState("");
  const [location, setLocation] = useState("");
  const [imageBase64, setImageBase64] = useState("");
  const [preview, setPreview] = useState("");
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<GeneratedItem[]>([]);
  const [status, setStatus] = useState<Record<string, string>>({});
  const [selectedAccount, setSelectedAccount] = useState<string | null>(null);
  const [profiles, setProfiles] = useState<SocialProfile[]>([]);
  const [newProfileName, setNewProfileName] = useState("");
  const [newProfileLoginId, setNewProfileLoginId] = useState("");
  const [newProfileNote, setNewProfileNote] = useState("");
  const [newProfilePasswordManager, setNewProfilePasswordManager] = useState("Chrome 密碼管理員");
  const [selectedProfiles, setSelectedProfiles] = useState<Record<string, string>>({});
  const [lastSentProfiles, setLastSentProfiles] = useState<Record<string, string>>({});
  const [linkedProfileIds, setLinkedProfileIds] = useState<string[]>([]);
  const [lastSentLinkedProfileIds, setLastSentLinkedProfileIds] = useState<string[]>([]);
  const [setupOpen, setSetupOpen] = useState(false);
  const [setupSelected, setSetupSelected] = useState<string[]>(RECOMMENDED_SETUP_IDS);
  const [setupCompleted, setSetupCompleted] = useState<string[]>([]);
  const [setupBrandName, setSetupBrandName] = useState("浮雲輕鬆遊");

  useEffect(() => {
    const adminToken = localStorage.getItem("admin_token") || "";
    if (!adminToken) {
      window.location.href = "/admin";
      return;
    }

    fetch("/api/auth/me", {
      headers: { Authorization: `Bearer ${adminToken}` },
      cache: "no-store",
    })
      .then((response) => {
        if (!response.ok) throw new Error("Unauthorized");
        setAuthChecked(true);
      })
      .catch(() => {
        localStorage.removeItem("admin_token");
        window.location.href = "/admin";
      });
  }, []);

  useEffect(() => {
    if (!authChecked) return;

    const savedProfiles = localStorage.getItem("fuyun-social-profiles");
    const savedSelected = localStorage.getItem("fuyun-social-selected");
    const savedLastSent = localStorage.getItem("fuyun-social-last-sent");
    const savedLinked = localStorage.getItem("fuyun-social-linked");
    const savedLastSentLinked = localStorage.getItem("fuyun-social-last-sent-linked");
    const savedSetupSelected = localStorage.getItem("fuyun-social-setup-selected");
    const savedSetupCompleted = localStorage.getItem("fuyun-social-setup-completed");

    if (savedProfiles) {
      try {
        setProfiles(JSON.parse(savedProfiles) as SocialProfile[]);
      } catch {
        localStorage.removeItem("fuyun-social-profiles");
      }
    }

    if (savedSelected) {
      try {
        setSelectedProfiles(JSON.parse(savedSelected) as Record<string, string>);
      } catch {
        localStorage.removeItem("fuyun-social-selected");
      }
    }

    if (savedLastSent) {
      try {
        const parsedLastSent = JSON.parse(savedLastSent) as Record<string, string>;
        setLastSentProfiles(parsedLastSent);
        if (!savedSelected) {
          setSelectedProfiles(parsedLastSent);
        }
      } catch {
        localStorage.removeItem("fuyun-social-last-sent");
      }
    }

    if (savedLinked) {
      try {
        setLinkedProfileIds(JSON.parse(savedLinked) as string[]);
      } catch {
        localStorage.removeItem("fuyun-social-linked");
      }
    }

    if (savedLastSentLinked) {
      try {
        const parsedLinked = JSON.parse(savedLastSentLinked) as string[];
        setLastSentLinkedProfileIds(parsedLinked);
        if (!savedLinked) {
          setLinkedProfileIds(parsedLinked);
        }
      } catch {
        localStorage.removeItem("fuyun-social-last-sent-linked");
      }
    }

    if (savedSetupSelected) {
      try {
        setSetupSelected(JSON.parse(savedSetupSelected) as string[]);
      } catch {
        localStorage.removeItem("fuyun-social-setup-selected");
      }
    }

    if (savedSetupCompleted) {
      try {
        setSetupCompleted(JSON.parse(savedSetupCompleted) as string[]);
      } catch {
        localStorage.removeItem("fuyun-social-setup-completed");
      }
    }
  }, [authChecked]);

  function onFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || "");
      setImageBase64(result);
      setPreview(result);
    };
    reader.readAsDataURL(file);
  }

  async function handleGenerate() {
    if (!text.trim() || !imageBase64) {
      alert("請輸入文字並上傳圖片");
      return;
    }

    setLoading(true);
    setItems([]);
    setStatus({});
    setLastSentProfiles(selectedProfiles);
    localStorage.setItem("fuyun-social-last-sent", JSON.stringify(selectedProfiles));
    setLastSentLinkedProfileIds(linkedProfileIds);
    localStorage.setItem("fuyun-social-last-sent-linked", JSON.stringify(linkedProfileIds));

    try {
      const response = await fetch("/api/social/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("admin_token") || ""}`,
        },
        body: JSON.stringify({ text, location, imageBase64 }),
      });
      const data: { success?: boolean; items?: GeneratedItem[]; error?: string } = await response.json();

      if (data.success && data.items) {
        setItems(data.items);
      } else {
        alert(`生成失敗：${data.error || "未知錯誤"}`);
      }
    } catch (error) {
      alert(`生成錯誤：${String(error)}`);
    } finally {
      setLoading(false);
    }
  }

  async function handlePublish(item: GeneratedItem) {
    setStatus((current) => ({ ...current, [item.platform]: "發布中..." }));

    try {
      const response = await fetch("/api/social/publish", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("admin_token") || ""}`,
        },
        body: JSON.stringify({
          platform: item.platform,
          caption: item.caption,
          imageUrl: item.imageUrl,
        }),
      });
      const data: { success?: boolean; error?: string } = await response.json();

      setStatus((current) => ({
        ...current,
        [item.platform]: data.success ? "已發布" : `發布失敗：${data.error || "未知錯誤"}`,
      }));
    } catch (error) {
      setStatus((current) => ({ ...current, [item.platform]: `發布失敗：${String(error)}` }));
    }
  }

  async function copyText(caption: string) {
    await navigator.clipboard.writeText(caption);
  }

  function imageSource(item: GeneratedItem) {
    return item.imageUrl || item.imageDataUrl;
  }

  function isConnected(accountId: string) {
    if (accountId === "line") return connections.line;
    if (accountId === "facebook") return connections.facebook;
    if (accountId === "instagram") return connections.instagram;
    if (accountId === "x") return connections.x;
    return false;
  }

  const activeAccount = SOCIAL_ACCOUNTS.find((account) => account.id === selectedAccount);
  const activeProfiles = profiles.filter((profile) => profile.platform === selectedAccount);
  const primarySendProfiles = SOCIAL_ACCOUNTS.flatMap((account) => {
    const profileId = selectedProfiles[account.id] || lastSentProfiles[account.id];
    const profile = profiles.find((item) => item.id === profileId);
    return profile ? [{ id: profile.id, platform: account.label, name: profile.name, linked: false }] : [];
  });
  const effectiveLinkedIds = linkedProfileIds.length ? linkedProfileIds : lastSentLinkedProfileIds;
  const linkedSendProfiles = effectiveLinkedIds.flatMap((profileId) => {
    const profile = profiles.find((item) => item.id === profileId);
    const account = SOCIAL_ACCOUNTS.find((item) => item.id === profile?.platform);
    return profile && account
      ? [{ id: profile.id, platform: account.label, name: profile.name, linked: true }]
      : [];
  });
  const currentSendProfiles = [...primarySendProfiles, ...linkedSendProfiles].filter(
    (profile, index, all) => all.findIndex((item) => item.id === profile.id) === index,
  );

  function saveProfiles(nextProfiles: SocialProfile[]) {
    setProfiles(nextProfiles);
    localStorage.setItem("fuyun-social-profiles", JSON.stringify(nextProfiles));
  }

  function addProfile() {
    if (!activeAccount || !newProfileName.trim()) {
      return;
    }

    const profile: SocialProfile = {
      id: `${activeAccount.id}-${Date.now()}`,
      platform: activeAccount.id,
      name: newProfileName.trim(),
      loginId: newProfileLoginId.trim(),
      note: newProfileNote.trim(),
      passwordManager: newProfilePasswordManager,
    };
    const nextProfiles = [...profiles, profile];
    const nextSelected = { ...selectedProfiles, [activeAccount.id]: profile.id };

    saveProfiles(nextProfiles);
    setSelectedProfiles(nextSelected);
    localStorage.setItem("fuyun-social-selected", JSON.stringify(nextSelected));
    setNewProfileName("");
    setNewProfileLoginId("");
    setNewProfileNote("");
  }

  function selectProfile(platform: string, profileId: string) {
    const nextSelected = { ...selectedProfiles, [platform]: profileId };
    setSelectedProfiles(nextSelected);
    localStorage.setItem("fuyun-social-selected", JSON.stringify(nextSelected));
  }

  function toggleLinkedProfile(profileId: string) {
    const nextLinked = linkedProfileIds.includes(profileId)
      ? linkedProfileIds.filter((id) => id !== profileId)
      : [...linkedProfileIds, profileId];
    setLinkedProfileIds(nextLinked);
    localStorage.setItem("fuyun-social-linked", JSON.stringify(nextLinked));
  }

  function removeProfile(profileId: string) {
    const target = profiles.find((profile) => profile.id === profileId);
    if (!target) return;

    const nextProfiles = profiles.filter((profile) => profile.id !== profileId);
    const nextSelected = { ...selectedProfiles };
    if (nextSelected[target.platform] === profileId) {
      delete nextSelected[target.platform];
    }

    saveProfiles(nextProfiles);
    setSelectedProfiles(nextSelected);
    localStorage.setItem("fuyun-social-selected", JSON.stringify(nextSelected));
    const nextLinked = linkedProfileIds.filter((id) => id !== profileId);
    setLinkedProfileIds(nextLinked);
    localStorage.setItem("fuyun-social-linked", JSON.stringify(nextLinked));
  }

  function toggleSetupPlatform(platformId: string) {
    const nextSelected = setupSelected.includes(platformId)
      ? setupSelected.filter((id) => id !== platformId)
      : [...setupSelected, platformId];
    setSetupSelected(nextSelected);
    localStorage.setItem("fuyun-social-setup-selected", JSON.stringify(nextSelected));
  }

  function completeSetupPlatform(platformId: string) {
    const nextCompleted = setupCompleted.includes(platformId)
      ? setupCompleted.filter((id) => id !== platformId)
      : [...setupCompleted, platformId];
    setSetupCompleted(nextCompleted);
    localStorage.setItem("fuyun-social-setup-completed", JSON.stringify(nextCompleted));

    if (!setupCompleted.includes(platformId) && !profiles.some((profile) => profile.platform === platformId)) {
      const profile: SocialProfile = {
        id: `${platformId}-${Date.now()}`,
        platform: platformId,
        name: setupBrandName.trim() || "待補帳號名稱",
        note: "一次性開戶導引建立",
        passwordManager: "Chrome 密碼管理員",
      };
      saveProfiles([...profiles, profile]);
    }
  }

  const selectedSetupAccounts = SOCIAL_ACCOUNTS.filter((account) => setupSelected.includes(account.id));
  const setupDoneCount = selectedSetupAccounts.filter((account) => setupCompleted.includes(account.id)).length;

  if (!authChecked) {
    return (
      <main className={styles.container}>
        <p className={styles.authLoading}>正在確認後台權限...</p>
      </main>
    );
  }

  return (
    <main className={styles.container}>
      <section className={styles.header}>
        <a href="/admin" className={styles.backLink}>返回管理首頁</a>
        <p className={styles.kicker}>浮雲輕鬆遊</p>
        <h1 className={styles.title}>社群一鍵分發</h1>
      </section>

      <section className={styles.inputSection} aria-label="社群內容輸入">
        <input
          type="text"
          placeholder="地點（選填，例如：阿里山）"
          value={location}
          onChange={(event) => setLocation(event.target.value)}
          className={styles.input}
        />
        <textarea
          placeholder="輸入原始內容..."
          value={text}
          onChange={(event) => setText(event.target.value)}
          className={styles.textarea}
          rows={4}
        />
        <label className={styles.photoPicker}>
          <span>拍照或選擇照片</span>
          <input type="file" accept="image/*" onChange={onFile} className={styles.fileInput} />
        </label>
        <span className={styles.photoHint}>手機可直接開啟相機或從相簿選取。</span>
        {preview ? <img src={preview} alt="原圖預覽" className={styles.preview} /> : null}

        <div className={styles.accountSection}>
          <div className={styles.accountHeading}>
            <span>社群帳號</span>
            <button type="button" className={styles.setupToggle} onClick={() => setSetupOpen((current) => !current)}>
              {setupOpen ? "收起開戶導引" : "一次建立帳號導引"}
            </button>
          </div>

          {setupOpen ? (
            <div className={styles.setupWizard}>
              <div className={styles.setupHeader}>
                <strong>一次性開戶清單</strong>
                <span>
                  已完成 {setupDoneCount}／{selectedSetupAccounts.length}
                </span>
              </div>
              <input
                type="text"
                value={setupBrandName}
                onChange={(event) => setSetupBrandName(event.target.value)}
                className={styles.profileInput}
                placeholder="統一辨識名稱，例如：浮雲輕鬆遊"
              />
              <div className={styles.setupPlatformGrid}>
                {SOCIAL_ACCOUNTS.map((account) => (
                  <label key={account.id} className={styles.setupPlatformChoice}>
                    <input
                      type="checkbox"
                      checked={setupSelected.includes(account.id)}
                      onChange={() => toggleSetupPlatform(account.id)}
                    />
                    <span>{account.label}</span>
                  </label>
                ))}
              </div>
              <div className={styles.setupSteps}>
                {selectedSetupAccounts.map((account, index) => {
                  const completed = setupCompleted.includes(account.id);
                  return (
                    <div key={account.id} className={`${styles.setupStep} ${completed ? styles.setupStepDone : ""}`}>
                      <span className={styles.setupNumber}>{completed ? "✓" : index + 1}</span>
                      <span className={styles.setupStepName}>{account.label}</span>
                      <a href={account.createUrl} target="_blank" rel="noopener noreferrer" className={styles.setupOpenBtn}>
                        開官方註冊頁
                      </a>
                      <button
                        type="button"
                        className={styles.setupCompleteBtn}
                        onClick={() => completeSetupPlatform(account.id)}
                      >
                        {completed ? "取消完成" : "完成"}
                      </button>
                    </div>
                  );
                })}
              </div>
              <p className={styles.setupNotice}>
                手機驗證、Email、實名、公司文件及驗證碼必須由你本人在官方頁面完成。本頁只記錄進度。
              </p>
            </div>
          ) : null}

          <span className={styles.accountHint}>點選縮圖查看連線狀態與管理多個帳號</span>
          <div className={styles.accountButtons}>
            {SOCIAL_ACCOUNTS.map((account) => {
              const connected = isConnected(account.id);
              const manual = account.mode === "manual";

              return (
                <button
                  key={account.id}
                  type="button"
                  className={`${styles.accountButton} ${styles[`account_${account.id}`]} ${
                    connected ? styles.accountConnected : ""
                  }`}
                  onClick={() => setSelectedAccount(account.id)}
                  aria-label={`新增或設定 ${account.label}`}
                  title={`${account.label}：${connected ? "已連線" : manual ? "手動發布" : "待授權"}`}
                >
                  <span className={styles.accountMark}>{account.shortLabel}</span>
                  <span className={connected ? styles.statusConnected : manual ? styles.statusManual : styles.statusPending} />
                </button>
              );
            })}
            <button
              type="button"
              className={`${styles.accountButton} ${styles.accountAdd}`}
              onClick={() => setSelectedAccount("add")}
              aria-label="新增其他社群帳號"
              title="新增其他社群帳號"
            >
              <span className={styles.addMark}>+</span>
            </button>
          </div>

          {selectedAccount ? (
            <div className={styles.accountMessage}>
              {selectedAccount === "add" ? (
                <>
                  <strong>新增其他社群</strong>
                  <span>請告訴我平台名稱，我會先確認是否有官方發布 API，再建立連線。</span>
                </>
              ) : activeAccount?.mode === "manual" ? (
                <>
                  <strong>{activeAccount.label}</strong>
                  <span>不需要提供帳號密碼。本系統會產生文案與圖片，由你手動貼到 App，避免封號風險。</span>
                </>
              ) : isConnected(activeAccount?.id || "") ? (
                <>
                  <strong>{activeAccount?.label}已設定</strong>
                  <span>系統已偵測到連線憑證，正式發布前仍會由你按下發布按鈕確認。</span>
                </>
              ) : (
                <>
                  <strong>{activeAccount?.label}需要官方授權</strong>
                  <span>不用把密碼給我；後續會由官方登入授權頁取得發布權限。</span>
                </>
              )}

              {activeAccount ? (
                <div className={styles.profileManager}>
                  <div className={styles.profileActions}>
                    <a href={activeAccount.createUrl} target="_blank" rel="noopener noreferrer" className={styles.createAccountBtn}>
                      建立新帳號
                    </a>
                    <a href={activeAccount.loginUrl} target="_blank" rel="noopener noreferrer" className={styles.loginAccountBtn}>
                      登入已有帳號
                    </a>
                  </div>

                  <div className={styles.profileAddRow}>
                    <input
                      type="text"
                      value={newProfileName}
                      onChange={(event) => setNewProfileName(event.target.value)}
                      placeholder="輸入辨識名稱，例如：浮雲輕鬆遊"
                      className={styles.profileInput}
                    />
                    <input
                      type="text"
                      value={newProfileLoginId}
                      onChange={(event) => setNewProfileLoginId(event.target.value)}
                      placeholder="登入帳號，例如：Email、手機或帳號 ID"
                      className={styles.profileInput}
                    />
                    <input
                      type="text"
                      value={newProfileNote}
                      onChange={(event) => setNewProfileNote(event.target.value)}
                      placeholder="用途備註，例如：公司主帳號、旅遊廣告、小號"
                      className={styles.profileInput}
                    />
                    <select
                      value={newProfilePasswordManager}
                      onChange={(event) => setNewProfilePasswordManager(event.target.value)}
                      className={styles.profileInput}
                      aria-label="密碼保管位置"
                    >
                      <option>Chrome 密碼管理員</option>
                      <option>Edge 密碼管理員</option>
                      <option>手機密碼管理員</option>
                      <option>尚未保存</option>
                    </select>
                    <button type="button" onClick={addProfile} className={styles.profileAddBtn}>
                      加入帳號清單
                    </button>
                  </div>

                  {activeProfiles.length ? (
                    <div className={styles.profileList}>
                      {activeProfiles.map((profile) => (
                        <div key={profile.id} className={styles.profileRow}>
                          <button
                            type="button"
                            className={`${styles.profileSelect} ${
                              selectedProfiles[activeAccount.id] === profile.id ? styles.profileSelected : ""
                            }`}
                            onClick={() => selectProfile(activeAccount.id, profile.id)}
                          >
                            <span className={styles.profileRadio} />
                            <span className={styles.profileDetails}>
                              <strong>{profile.name}</strong>
                              {profile.loginId ? <span>登入：{profile.loginId}</span> : null}
                              {profile.note ? <span>備註：{profile.note}</span> : null}
                              <span>密碼保管：{profile.passwordManager || "尚未紀錄"}</span>
                              {selectedProfiles[activeAccount.id] === profile.id ? (
                                <span className={styles.defaultLabel}>預設發布帳號</span>
                              ) : null}
                            </span>
                          </button>
                          <button
                            type="button"
                            onClick={() => toggleLinkedProfile(profile.id)}
                            className={`${styles.profileLinkToggle} ${
                              linkedProfileIds.includes(profile.id) ? styles.profileLinked : ""
                            }`}
                            aria-pressed={linkedProfileIds.includes(profile.id)}
                            title="設為連動轉發帳號"
                          >
                            {linkedProfileIds.includes(profile.id) ? "已連動" : "連動"}
                          </button>
                          <button
                            type="button"
                            onClick={() => removeProfile(profile.id)}
                            className={styles.profileRemove}
                            aria-label={`移除 ${profile.name}`}
                            title="移除帳號名稱"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <span className={styles.profileEmpty}>尚未加入這個平台的帳號名稱。</span>
                  )}
                  <span className={styles.passwordNotice}>
                    密碼不儲存在本系統。登入時由 Chrome／Edge 密碼管理員自動填入，較安全也更方便。
                  </span>
                </div>
              ) : null}
            </div>
          ) : null}

          <div className={styles.sendGroup}>
            <strong>本次預設發送帳號群</strong>
            {currentSendProfiles.length ? (
              <div className={styles.sendGroupList}>
                {currentSendProfiles.map((profile) => (
                  <span key={profile.id}>
                    {profile.linked ? "連動 " : ""}
                    {profile.platform}：{profile.name}
                  </span>
                ))}
              </div>
            ) : (
              <span>尚未選擇帳號。選過一次後，未變更時會自動沿用上次設定。</span>
            )}
          </div>
        </div>

        <div className={styles.generateBar}>
          <button type="button" onClick={handleGenerate} disabled={loading} className={styles.generateBtn}>
            {loading ? "生成中..." : "一鍵生成各平台版本"}
          </button>
        </div>
      </section>

      <section className={styles.cards} aria-label="社群平台版本">
        {items.map((item) => (
          <article key={item.platform} className={styles.card}>
            <div className={styles.cardHeader}>
              <span className={styles.platformName}>{item.label}</span>
              <span className={item.autoPost ? styles.autoTag : styles.manualTag}>
                {item.autoPost ? "全自動" : "半自動"}
              </span>
            </div>

            {imageSource(item) ? (
              <img src={imageSource(item) || ""} alt={item.label} className={styles.cardImage} />
            ) : (
              <p className={styles.noImage}>R2 尚未設定，無公開圖片網址。</p>
            )}

            <textarea value={item.caption} readOnly className={styles.cardCaption} rows={6} />

            <div className={styles.cardActions}>
              {item.autoPost ? (
                <button
                  type="button"
                  onClick={() => handlePublish(item)}
                  disabled={!item.imageUrl && item.platform !== "x"}
                  className={styles.publishBtn}
                >
                  發布到 {item.label}
                </button>
              ) : (
                <>
                  <button type="button" onClick={() => copyText(item.caption)} className={styles.copyBtn}>
                    複製文案
                  </button>
                  {imageSource(item) ? (
                    <a href={imageSource(item) || ""} download={`${item.platform}.jpg`} className={styles.downloadBtn}>
                      下載圖片
                    </a>
                  ) : null}
                </>
              )}
            </div>

            {status[item.platform] ? <p className={styles.status}>{status[item.platform]}</p> : null}
          </article>
        ))}
      </section>
    </main>
  );
}
