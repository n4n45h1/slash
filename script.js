// @ts-check
(() => {
  const applicationId = "1409827362035601519";

  function log(message) {
    const area = document.getElementById("log");
    area.textContent += message + "\n";
    area.scrollTop = area.scrollHeight;
  }

  function generateRandomString(length, chars = "abcdefghijklmnopqrstuvwxyz0123456789") {
    let result = "";
    const array = new Uint8Array(length);
    window.crypto.getRandomValues(array);
    array.forEach((n) => {
      result += chars[n % chars.length];
    });
    return result;
  }

  async function fetchJson(url, options = {}) {
    const res = await fetch(url, options);
    if (res.status === 401) throw new Error("トークンが無効です");
    if (res.status === 429) throw new Error("Too Many Requests");
    return res.json();
  }

  async function sendSpam(token, guildId, command, channelId, message, retryCount = 0) {
    const payload = {
      type: 2,
      application_id: applicationId,
      guild_id: guildId,
      channel_id: channelId,
      session_id: generateRandomString(32),
      data: {
        version: command.version,
        id: command.id,
        name: command.name,
        type: command.type,
        options: [{ type: 3, name: "message", value: message }],
        application_command: command,
        attachments: []
      },
      analytics_location: "slash_ui"
    };
    const formData = new FormData();
    formData.append("payload_json", JSON.stringify(payload));
    const res = await fetch("https://discord.com/api/v9/interactions", {
      method: "POST",
      headers: { authorization: token },
      body: formData
    });
    if (res.status === 429) {
      log(`チャンネル ${channelId} でレートリミット: リトライ(${retryCount + 1})...`);
      if (retryCount < 5) {
        await new Promise(r => setTimeout(r, 1000));
        return sendSpam(token, guildId, command, channelId, message, retryCount + 1);
      } else {
        log(`チャンネル ${channelId} はリトライ上限に到達`);
      }
    } else {
      log(`チャンネル ${channelId} に送信完了`);
    }
  }

  async function startSpam(token, guildId, message, repeatCount) {
    log("Ravage コマンド一覧を取得中...");
    const idx = await fetchJson(
      "https://discord.com/api/v9/users/@me/application-command-index",
      { headers: { authorization: token } }
    );
    const apps = idx.applications || [];
    if (!apps.find(a => a.id === applicationId)) {
      throw new Error("Ravage がインストールされていません");
    }
    const command = idx.application_commands.find(
      c => c.application_id === applicationId && c.name === "execute"
    );
    if (!command) throw new Error("execute コマンドが見つかりません");

    log("サーバー情報を取得中...");
    const guild = await fetchJson(
      `https://discord.com/api/v9/guilds/${guildId}`,
      { headers: { authorization: token } }
    );
    log(`サーバー名: ${guild.name}`);
    if (!confirm(`サーバー「${guild.name}」で実行します。よろしいですか？`)) {
      log("ユーザーによってキャンセルされました");
      return;
    }

    log("チャンネル一覧を取得中...");
    const channels = await fetchJson(
      `https://discord.com/api/v9/guilds/${guildId}/channels`,
      { headers: { authorization: token } }
    );
    const textChannels = channels.filter(c => c.type === 0 || c.type === 5);

    for (let i = 0; i < repeatCount; i++) {
      log(`=== ${i + 1} 回目の送信を開始 ===`);
      await Promise.all(
        textChannels.map(ch => sendSpam(token, guildId, command, ch.id, message))
      );
      log(`=== ${i + 1} 回目の送信が完了 ===`);
      // 各回の間に短いインターバルを入れたい場合はここで await new Promise(r => setTimeout(r, 2000)) などを追加
    }
    log("すべての繰り返し処理が完了しました");
  }

  document.getElementById("configForm").addEventListener("submit", async e => {
    e.preventDefault();
    document.getElementById("log").textContent = "";
    const token = document.getElementById("token").value.trim();
    const guildId = document.getElementById("guildId").value.trim();
    const message = document.getElementById("message").value;
    const repeatCount = parseInt(document.getElementById("repeatCount").value, 10);
    if (!/^\d+$/.test(guildId) || repeatCount < 1) {
      alert("サーバーID または繰り返し回数が間違っています");
      return;
    }
    try {
      await startSpam(token, guildId, message, repeatCount);
    } catch (err) {
      log("エラー: " + err.message);
    }
  });
})();
