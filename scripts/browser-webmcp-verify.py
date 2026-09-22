#!/usr/bin/env python3
"""
browser-webmcp-verify.py — 真實 Chromium 149 端上驗證 WebMCP
（Python 版，因 Node 18 被 playwright 擋）

驗證：
  1. document.modelContext 存在（enable-webmcp-testing flag 生效）
  2. getTools() 列出 get_quote + schema
  3. executeTool("get_quote", {...}) 回傳 ok=true + LINE 連結
  4. 人類表單端到端：fill 5 欄 → submit → #webmcp-quote-output 顯示草稿
  5. 存截圖 /tmp/webmcp-browser-verify.png

執行：
  cd /home/arashiyun/fuyun-travel && /home/arashiyun/fuyun-ai-stack/.venv/bin/python3 scripts/browser-webmcp-verify.py

退出碼：0=全綠，1=任一失敗
"""
import os, sys, glob

from playwright.sync_api import sync_playwright

BASE = os.environ.get("WEBMCP_BASE", "http://127.0.0.1:3177")
PAGE = f"{BASE}/charter-bus/taipei"

def find_chromium():
    """回傳 Chromium 149 二進位路徑；找不到回 None"""
    primary = "/home/arashiyun/hermes-fenshenmin/.cache/ms-playwright/chromium-1228/chrome-linux/chrome"
    if os.path.exists(primary):
        return primary
    for base in (os.path.expanduser("~/.cache/ms-playwright"), os.path.expanduser("~/hermes-fenshenmin/.cache/ms-playwright")):
        cands = glob.glob(f"{base}/chromium-*/chrome-linux*/chrome")
        cands = [c for c in cands if "headless" not in c]
        if cands:
            return cands[0]
    return None

# 一次塞多組候選 feature（Chromium 會忽略不認識的，安全）：
# 二進位 strings 見: enable-webmcp-testing / ModelContextTesting / kDeclarativeWebmcp / WebMCP
FEATURES = "WebMCP,WebMCPTesting,ModelContextTesting,EnableWebMCPTesting,kDeclarativeWebmcp"

class Tally:
    passed = 0
    failed = 0

def check(name, cond, detail=""):
    if cond:
        Tally.passed += 1
        print(f"  PASS  {name}")
    else:
        Tally.failed += 1
        print(f"  FAIL  {name}  — {detail}")


def main():
    chrome = find_chromium()
    if not chrome:
        print("找不到 Playwright Chromium")
        sys.exit(1)
    print("Chromium:", chrome)

    with sync_playwright() as p:
        browser = p.chromium.launch(
            executable_path=chrome,
            headless=True,
            args=["--no-sandbox", f"--enable-features={FEATURES}", "--disable-gpu"],
        )
        ctx = browser.new_context(viewport={"width":1280,"height":900})
        page = ctx.new_page()

        # ---- Origin isolation：官方明說「WebMCP is only available in origin-isolated documents」
        # 只攔頂層文件（COOP/COEP 是文件級），不攔子資源，避免弄壞 HMR/websocket ----
        def _add_origin_isolation(route):
            try:
                resp = route.fetch()
                h = resp.headers
                h = dict(h) if isinstance(h, dict) else dict(h.items())
                b = respbody = resp.body
                if callable(b):
                    b = b()
                h["cross-origin-opener-policy"] = "same-origin"
                h["cross-origin-embedder-policy"] = "require-corp"
                route.fulfill(status=resp.status, headers=h, body=b)
            except Exception as e:
                print(f"  [route intercept error] {e}")
                try:
                    route.abort()
                except Exception:
                    pass
        page.route(PAGE, _add_origin_isolation)

        logs = []
        page.on("console", lambda m: logs.append(f"{m.type}: {m.text}"))
        page.on("pageerror", lambda e: logs.append(f"PAGEERROR: {e}"))

        print(f"導向 {PAGE}")
        page.goto(PAGE, wait_until="domcontentloaded", timeout=60_000)
        page.wait_for_selector("section.webmcp-quote-tool", timeout=30_000)
        page.wait_for_timeout(600)

        print("\n=== 端上 document.modelContext ===")
        state = page.evaluate("""() => {
            const d = window.document;
            const has = typeof d.modelContext;
            if (has !== 'object' || !d.modelContext) return { has };
            let tools=null, toolsErr=null, exec=null, execErr=null, name=null;
            try { tools = (d.modelContext.getTools && d.modelContext.getTools()) || null; } catch(e){ toolsErr=String(e); }
            try {
              name = (tools && tools.length ? tools[0].name : 'get_quote');
              exec = d.modelContext.executeTool && d.modelContext.executeTool(name, { from:'台北', to:'阿里山', date:'2026-09-05', party:12, luggage:'3 件', contactName:'黃先生', contactPhone:'0912345678' });
            } catch(e){ execErr=String(e); }
            return { has, name, tools, toolsErr, exec, execErr };
        }""")
        print("typeof document.modelContext =", state.get("has"))
        check("document.modelContext 存在（flag 生效，experimental 端上可見）", state.get("has") == "object", f"got: {state.get('has')}")

        if state.get("has") == "object":
            names = [t.get("name") for t in (state.get("tools") or [])]
            print("  getTools() =>", names)
            check("getTools() 含 get_quote", "get_quote" in names, str(names))
            tools_obj = (state.get("tools") or [{}])[0]
            schema = tools_obj.get("inputSchema") or {}
            print("  schema.required =", schema.get("required"))
            execres = state.get("exec") or {}
            check("executeTool 回 ok=true", execres.get("ok") is True, str(execres)[:300] + f" | execErr={state.get('execErr')}")
            line_url = execres.get("lineUrl") or ""
            check("executeTool 回傳 LINE 深連結", "line.me/R/ti/p/" in line_url, line_url[:80])
            check("executeTool 回傳 message 含 12 人", "12 人" in (execres.get("message") or ""), (execres.get("message") or "")[:80])
            if execres.get("message"):
                print("  --- executeTool message 前 6 行 ---")
                print("  " + "\n  ".join(execres["message"].splitlines()[:6]))
        else:
            check("getTools()", False, "modelContext 不存在（flag 未生效？）")

        print("\n=== 人類表單端到端 ===")
        page.fill('input[name="from"]', "台北")
        page.fill('input[name="to"]', "阿里山")
        page.fill('input[name="date"]', "2026-09-05")
        page.fill('input[name="party"]', "12")
        page.fill('input[name="luggage"]', "3 件")
        page.fill('input[name="contactName"]', "黃先生")
        page.click('button[type="submit"]')
        page.wait_for_selector("#webmcp-quote-output:not([hidden])", timeout=8_000)
        out_text = page.locator("#webmcp-quote-output").text_content() or ""
        print("  OUTPUT 文字:")
        for ln in out_text.splitlines()[:8]:
            print("   |", ln)
        check("表單提交 → 顯示「草稿已建立」", "草稿已建立" in out_text, out_text[:120])
        check("表單提交 → 顯示 LINE 連結", "line.me" in out_text, out_text[:120])

        print("\n=== 頁面 console 末 10 行 ===")
        for l in logs[-10:]:
            print("  ", l)
        if not logs:
            print("   (無 console)")

        page.screenshot(path="/tmp/webmcp-browser-verify.png", full_page=False)
        print("\n截圖: /tmp/webmcp-browser-verify.png")

        browser.close()

    print(f"\n========== BROWSER VERIFY ==========")
    print(f"PASS: {Tally.passed}   FAIL: {Tally.failed}")
    sys.exit(1 if Tally.failed else 0)

if __name__ == "__main__":
    main()
