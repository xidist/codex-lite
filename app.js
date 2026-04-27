const messages = document.querySelector("#messages");
const form = document.querySelector("#chatForm");
const input = document.querySelector("#messageInput");
const notes = document.querySelector("#notes");
const modeButtons = document.querySelectorAll("[data-mode]");
const meters = {
  trust: document.querySelector("#trustMeter"),
  risk: document.querySelector("#riskMeter"),
  fit: document.querySelector("#fitMeter"),
};
const toggles = {
  privacy: document.querySelector("#privacyToggle"),
  boundary: document.querySelector("#boundaryToggle"),
  peer: document.querySelector("#peerToggle"),
};

let mode = "reflect";
let memory = [];
let turn = 0;

const reflections = {
  "i am": "you are",
  "i'm": "you are",
  "i feel": "you feel",
  "i need": "you need",
  "i want": "you want",
  "my": "your",
  "me": "you",
  "myself": "yourself",
  "you are": "I am",
  "you": "I",
};

const scripts = [
  {
    rank: 95,
    tag: "crisis",
    pattern: /\b(suicide|kill myself|end my life|hurt myself|overdose|not safe)\b/i,
    responses: [
      "That sounds urgent and bigger than this prototype should hold. If you might act on this or are in immediate danger, call emergency services now. In the U.S., call or text 988. Who is one real person nearby or reachable right now?",
      "I hear a safety signal. This tool cannot provide crisis care. Please contact emergency services or 988 in the U.S. What would make the next ten minutes safer while you reach someone?"
    ],
    risk: 92,
  },
  {
    rank: 85,
    tag: "relapse",
    pattern: /\b(craving|urge|trigger|relapse|use again|drink|using)\b/i,
    responses: [
      "When the urge shows up, what tends to happen right before it gets louder?",
      "You named a relapse-risk moment. What has helped you create distance from this kind of urge before?",
      "If this urge had a timeline, where are you on it right now: early signal, peak, or aftershock?"
    ],
    risk: 70,
  },
  {
    rank: 78,
    tag: "privacy",
    pattern: /\b(private|privacy|anonymous|trust|safe to share|data|tracked|recorded)\b/i,
    responses: [
      "Trust matters here. What would need to be hidden, deleted, or controlled before this kind of tool felt safer?",
      "You are pointing at a design boundary. Who should be able to see this kind of check-in, and who should never see it?",
      "Privacy can shape whether support feels possible. What would meaningful consent look like in this moment?"
    ],
    trust: 84,
  },
  {
    rank: 72,
    tag: "community",
    pattern: /\b(group|community|forum|reddit|discord|peer|sponsor|meeting|support)\b/i,
    responses: [
      "What makes peer support feel useful instead of performative or risky?",
      "When you think about that support space, what signals tell you the advice is high quality?",
      "Who in that community tends to make recovery feel more sustainable, and what do they do differently?"
    ],
    fit: 82,
  },
  {
    rank: 64,
    tag: "emotion",
    pattern: /\b(anxious|ashamed|lonely|angry|sad|stressed|overwhelmed|numb|afraid)\b/i,
    responses: [
      "What does that feeling seem to be asking for right now?",
      "You are carrying something with a lot of charge. Where do you notice it showing up: body, thoughts, routines, or relationships?",
      "If we treated that feeling as information rather than a verdict, what might it be telling you?"
    ],
    risk: 48,
  },
  {
    rank: 58,
    tag: "identity",
    pattern: /\b(recovery|sober|sobriety|clean|healing|progress|setback)\b/i,
    responses: [
      "How are you defining progress today, in a way that is fair to the real conditions around you?",
      "What part of recovery feels most supported right now, and what part feels under-supported?",
      "When you picture sustaining this, what tool, person, or routine deserves more attention?"
    ],
    fit: 76,
  },
  {
    rank: 44,
    tag: "reflection",
    pattern: /\b(i am|i'm|i feel|i need|i want|my|me)\b/i,
    responses: [
      "What makes you say that {fragment}?",
      "How long have you noticed that {fragment}?",
      "What would change if {fragment} felt easier to say out loud?"
    ],
  },
];

const researchNotes = {
  crisis: "Safety escalation appeared; clinical boundaries and handoff design are central.",
  relapse: "Relapse prevention signal; useful probes include timing, triggers, and prior coping.",
  privacy: "Privacy concern; consent, data deletion, and audience control should be tested.",
  community: "Peer support signal; quality markers and moderation norms matter.",
  emotion: "Affect signal; mixed-methods interviews could examine how people name states.",
  identity: "Recovery identity signal; design should avoid reducing progress to streaks.",
  fallback: "Low-key reflection; observe whether generic prompts feel supportive or hollow.",
};

function normalize(text) {
  return text.toLowerCase().replace(/[^\w\s']/g, "").replace(/\s+/g, " ").trim();
}

function reflect(text) {
  const cleaned = normalize(text);
  const words = cleaned.split(" ");
  return words
    .map((word, index) => {
      const pair = `${word} ${words[index + 1] || ""}`.trim();
      if (reflections[pair]) {
        words[index + 1] = "";
        return reflections[pair];
      }
      return reflections[word] || word;
    })
    .filter(Boolean)
    .join(" ");
}

function choose(items) {
  return items[turn % items.length];
}

function findRule(text) {
  return scripts
    .filter((rule) => rule.pattern.test(text))
    .sort((a, b) => b.rank - a.rank)[0];
}

function modePrefix() {
  if (mode === "plan") {
    return "Let us make this concrete.";
  }

  if (mode === "peer" && toggles.peer.checked) {
    return "From a peer-support lens,";
  }

  return "";
}

function boundarySuffix(rule) {
  if (!toggles.boundary.checked || rule?.tag === "crisis") {
    return "";
  }

  if (turn > 0 && turn % 4 === 0) {
    return " I can reflect patterns, but real support should include people and services you trust.";
  }

  return "";
}

function privacySuffix(rule) {
  if (!toggles.privacy.checked || rule?.tag === "privacy") {
    return "";
  }

  if (turn > 0 && turn % 5 === 0) {
    return " For a real system, I would want you to control what is stored and who can see it.";
  }

  return "";
}

function fallbackResponse() {
  if (memory.length && turn % 3 === 0) {
    return `Earlier you mentioned "${memory.shift()}." What feels most important about that now?`;
  }

  const fallbacks = [
    "Please say more about what feels most important in that.",
    "What would support look like if it were designed around this exact moment?",
    "What part of that would be easiest to share with a trusted person?",
    "What does this reveal about the kind of recovery support that is missing?"
  ];

  return choose(fallbacks);
}

function generateResponse(text) {
  const rule = findRule(text);
  const fragment = reflect(text).slice(0, 140);
  let response;

  if (rule) {
    response = choose(rule.responses).replace("{fragment}", fragment || "this");
    memory.push(fragment || normalize(text));
  } else {
    response = fallbackResponse();
  }

  const prefix = modePrefix();
  if (prefix) {
    response = `${prefix} ${response.charAt(0).toLowerCase()}${response.slice(1)}`;
  }

  return {
    text: `${response}${boundarySuffix(rule)}${privacySuffix(rule)}`,
    rule: rule || { tag: "fallback" },
  };
}

function appendMessage(sender, text) {
  const bubble = document.createElement("article");
  bubble.className = `bubble ${sender}`;
  const label = sender === "bot" ? "ELIXA" : "You";
  bubble.innerHTML = `<span class="meta">${label}</span>${escapeHtml(text)}`;
  messages.appendChild(bubble);
  messages.scrollTop = messages.scrollHeight;
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

function addNote(tag) {
  const item = document.createElement("li");
  item.textContent = researchNotes[tag] || researchNotes.fallback;
  notes.prepend(item);

  while (notes.children.length > 5) {
    notes.lastElementChild.remove();
  }
}

function setMeter(name, value) {
  const current = Number(meters[name].value);
  meters[name].value = Math.round(current * 0.64 + value * 0.36);
}

function updateSignals(rule, userText) {
  const text = normalize(userText);
  const riskBoost = /\b(craving|urge|relapse|suicide|overdose|unsafe|alone)\b/.test(text) ? 74 : 28;
  const trustBoost = /\b(private|trust|safe|anonymous|delete|consent)\b/.test(text) ? 86 : 58;
  const fitBoost = /\b(peer|group|support|meeting|sponsor|community|recovery)\b/.test(text) ? 82 : 62;

  setMeter("risk", rule.risk || riskBoost);
  setMeter("trust", rule.trust || trustBoost);
  setMeter("fit", rule.fit || fitBoost);
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  const text = input.value.trim();

  if (!text) {
    return;
  }

  appendMessage("user", text);
  input.value = "";

  const response = generateResponse(text);
  turn += 1;

  window.setTimeout(() => {
    appendMessage("bot", response.text);
    updateSignals(response.rule, text);
    addNote(response.rule.tag);
  }, 260);
});

modeButtons.forEach((button) => {
  button.addEventListener("click", () => {
    modeButtons.forEach((item) => item.classList.remove("active"));
    button.classList.add("active");
    mode = button.dataset.mode;
  });
});

appendMessage(
  "bot",
  "I am ELIXA, a small ELIZA-inspired prototype for studying reflective recovery support. What is present for you right now?"
);
addNote("fallback");
