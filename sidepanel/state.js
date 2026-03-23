/**
 * Consensus Engine — Shared State & DOM Helpers
 * Canonical declaration of the AID namespace. Loaded first among sidepanel scripts.
 */

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

const IDEAL_WIDTH = 400;
const ZOOM_MIN = 0.5;
const ZOOM_MAX = 2.0;
const ZOOM_DEFAULT = 0.815;
const ZOOM_STEP = 0.1;

window.AID = {
  session: null,
  settings: {},
  userZoom: ZOOM_DEFAULT,
  pendingInsertIndex: null,
  els: {},
};

/**
 * Populate AID.els with DOM references.
 * Called from init() — not at parse time — so script placement cannot cause silent nulls.
 */
AID.initEls = function () {
  AID.els = {
    roundCounter: $('#round-counter'),
    turnIndicator: $('#turn-indicator'),
    thread: $('#thread'),
    initialContextSection: $('#initial-context-section'),
    initialContext: $('#initial-context'),
    btnStartSession: $('#btn-start-session'),
    btnNewSession: $('#btn-new-session'),
    btnSessionsList: $('#btn-sessions-list'),
    btnSettings: $('#btn-settings'),
    actionBar: $('#action-bar'),
    btnPrepareHandoff: $('#btn-prepare-handoff'),
    handoffTarget: $('#handoff-target'),
    btnInterject: $('#btn-interject'),
    replyTarget: $('#reply-target'),
    consensusBar: $('#consensus-bar'),
    btnConsensus: $('#btn-consensus'),
    btnExportToggle: $('#btn-export-toggle'),
    exportDropdown: $('#export-dropdown'),
    btnExportMdHeader: $('#btn-export-md-header'),
    btnExportJsonHeader: $('#btn-export-json-header'),
    btnPushGithubHeader: $('#btn-push-github-header'),
    exportDropdownStatus: $('#export-dropdown-status'),
    interjectionSection: $('#interjection-section'),
    interjectionText: $('#interjection-text'),
    interjectionTarget: $('#interject-target'),
    interjectionTargetBtn: $('#interject-target-btn'),
    btnSubmitInterject: $('#btn-submit-interject'),
    btnCancelInterject: $('#btn-cancel-interject'),
    inlineInsertForm: $('#inline-insert-form'),
    inlineInsertSource: $('#inline-insert-source'),
    inlineInsertContent: $('#inline-insert-content'),
    btnSubmitInlineInsert: $('#btn-submit-inline-insert'),
    btnCancelInlineInsert: $('#btn-cancel-inline-insert'),
    viewConversation: $('#view-conversation'),
    viewSessions: $('#view-sessions'),
    sessionsList: $('#sessions-list'),
    btnBackConversation: $('#btn-back-conversation'),
    exportModal: $('#export-modal'),
    btnExportMd: $('#btn-export-md'),
    btnExportJson: $('#btn-export-json'),
    btnPushGithub: $('#btn-push-github'),
    btnCloseModal: $('#btn-close-modal'),
    btnCloseModalX: $('#btn-close-modal-x'),
    exportStatus: $('#export-status'),
    btnHelp: $('#btn-help'),
    helpModal: $('#help-modal'),
    btnCloseHelp: $('#btn-close-help'),
    btnThemeToggle: $('#btn-theme-toggle'),
    btnFontUp: $('#btn-font-up'),
    btnFontDown: $('#btn-font-down'),
    modLength: $('#mod-length'),
    modTone: $('#mod-tone'),
  };
};
