/**
 * Consensus Engine — Prompt Generation
 * Builds dialectic handoff and initial prompts.
 */

const LENGTH_INJECTIONS = {
  short:
    'Limit your response to 3-5 sentences maximum. Zero preamble, zero filler. Lead with your strongest point. No bullet points -- tight, opinionated prose only.',
  deep: 'Provide comprehensive analysis. Develop each argument fully with supporting reasoning, concrete examples, and edge cases. Structured formatting allowed. Thoroughness over brevity -- but no repetition.',
};

const TONE_INJECTIONS = {
  clinical:
    'Respond with strict analytical precision. No conversational language, no hedging, no pleasantries. State positions as direct logical claims. Identify flaws using formal reasoning. Every sentence must advance the argument.',
  socratic:
    'Adopt an intellectually rigorous tone. Use pointed, rhetorical questions to expose unstated assumptions, but immediately follow them with your own declarative counter-arguments. Be respectful but relentless. You may acknowledge good points before dismantling them.',
  sassy:
    'Be sharp, opinionated, and unapologetically direct. Show genuine intellectual impatience when the opposing position has obvious flaws -- express frustration, disbelief, or dry sarcasm. Call out lazy reasoning bluntly. However, your irritation must always be grounded in actual analytical substance -- never substitute attitude for argument. If the opposing model makes a genuinely strong point, grudgingly acknowledge it.',
};

const EXPANSION_INJECTIONS = {
  sparks:
    'Limit output to tagged one-liners. Aim for 10+ ideas. No explanation, no justification. Raw sparks only.',
  seeds:
    'Develop each idea with a 2-3 sentence expansion. Include specific variations, edge cases, or unexpected applications. Breadth and depth — but no evaluation.',
  branches:
    'Provide a full paragraph per idea with variations and applications. Thoroughness over brevity — but no evaluation or ranking.',
};

const PERSPECTIVE_INJECTIONS = {
  'rapid-fire':
    'Adopt a radically different analytical lens for your ideation. You must generate exactly 9 ideas per round — one for each of the following specific archetypes: [The Hacker], [The Aesthete], [The Futurist], [The Naturalist], [The Capitalist], [The Beginner], [The Psychologist], [The Historian], and [The Athlete]. Tag the lens in brackets at the start of each idea. State each idea as a direct, impersonal assertion derived purely from what that specific archetype values most.',
  contrarian:
    'Systematically invert the core assumptions of the topic. Generate ideas that do the exact opposite of conventional wisdom, standard industry practice, or logical next steps. Do not simply negate existing ideas — build viable alternatives from the inversion.',
  'first-principles':
    'Strip away all industry assumptions, jargon, and standard practices. Ask "why do we do it this way?" for each concept and build your ideas upward from fundamental physical, behavioral, or logical truths. Name the fundamental truth you\'re building from.',
};

const VECTOR_INJECTIONS = {
  who: 'Constrain your ideation entirely to the audience, shifting target users, creating bizarre partnerships, or applying the concept to entirely different demographics.',
  what: 'Constrain your ideation strictly to tangible outputs — what is actually being built, made, or produced. Focus on concrete deliverables.',
  when: 'Constrain your ideation entirely to time — time of day, macroeconomic cycles, historical eras, or future timelines.',
  where: 'Constrain your ideation entirely to location — physical space, geographic constraints, digital environments, or spatial computing.',
  why: 'Constrain your ideation entirely to motivations, human incentives, emotional resonance, market dynamics, and underlying philosophy.',
  how: 'Constrain your ideation entirely to novel implementations, bizarre technical workarounds, and physical/digital mechanics.',
  'what-if':
    'Constrain your ideation by systematically breaking the fundamental laws of the topic (physics, economics, social norms) and building ideas in that void.',
};

function buildModifierBlock(settings) {
  if (settings.brainstormMode) {
    const expansionVal = settings.modExpansion || 'sparks';
    const perspectiveVal = settings.modPerspective || 'rapid-fire';
    const vectorVal = settings.modVector || 'all';

    const parts = [];
    if (EXPANSION_INJECTIONS[expansionVal]) {
      parts.push(EXPANSION_INJECTIONS[expansionVal]);
    }
    if (PERSPECTIVE_INJECTIONS[perspectiveVal]) {
      parts.push(PERSPECTIVE_INJECTIONS[perspectiveVal]);
    }
    if (vectorVal !== 'all' && VECTOR_INJECTIONS[vectorVal]) {
      parts.push(VECTOR_INJECTIONS[vectorVal]);
    }

    if (parts.length === 0) return '';
    return '\n\n### RUNTIME MODIFIERS ###\n' + parts.join('\n');
  }

  const lengthVal = settings.modLength || 'normal';
  const toneVal = settings.modTone || 'default';

  if (lengthVal === 'normal' && toneVal === 'default') return '';

  const parts = [];
  if (lengthVal !== 'normal' && LENGTH_INJECTIONS[lengthVal]) {
    parts.push(LENGTH_INJECTIONS[lengthVal]);
  }
  if (toneVal !== 'default' && TONE_INJECTIONS[toneVal]) {
    parts.push(TONE_INJECTIONS[toneVal]);
  }

  return '\n\n### RUNTIME MODIFIERS ###\n' + parts.join('\n');
}

function generateInitialPrompt(context, settings) {
  const parts = [];

  if (settings.systemContext) {
    parts.push(`[System context: ${settings.systemContext}]`);
    parts.push('');
  }

  if (settings.brainstormMode) {
    parts.push('=== BRAINSTORM — ROUND 1 ===');
    parts.push(
      'Generative ideation between independent AI contributors. Build on every idea presented. Add novel directions the other contributor hasn\'t explored.',
    );
    parts.push(
      'Do not evaluate, critique, rank, or filter ideas. Volume and diversity over quality.',
    );
    parts.push(
      'Do NOT converge on recommendations, narrow to "top picks," or produce polished deliverables unless the user explicitly asks. Focus on expanding the possibility space.',
    );
    parts.push(
      'Focus on conceptual novelty. No abstract jargon as a substitute.',
    );
    parts.push('');
    parts.push('--- INITIAL CONTEXT (msgid#1) ---');
    parts.push(context);
    parts.push('');
    parts.push('--- YOUR TASK ---');
    parts.push('1. Generate as many distinct ideas as possible related to the initial context');
    parts.push('2. Explore unexpected angles, tangents, and creative leaps');
    parts.push('3. Tag each idea with a bracketed label (e.g., [Distribution], [UX], [Pricing])');
    parts.push('4. Do NOT evaluate or rank — quantity and variety over quality');
  } else {
    parts.push('=== DIALECTIC — ROUND 1 ===');
    parts.push(
      'Structured dialectic between independent AI analysts. Challenge errors, defend sound positions, update only when genuinely persuaded. Do not soften disagreements.',
    );
    parts.push(
      'Do NOT produce finished documents, specs, summaries, or deliverables unless the user explicitly asks. Focus on dialectic reasoning and decision-making.',
    );
    parts.push('');
    parts.push('--- INITIAL CONTEXT (msgid#1) ---');
    parts.push(context);
    parts.push('');
    parts.push('--- YOUR TASK ---');
    parts.push('1. Analyze the initial context thoroughly');
    parts.push('2. State your position clearly with supporting reasoning');
    parts.push('3. Identify key assumptions and potential weaknesses in your own analysis');
    parts.push('4. Provide your complete, honest assessment');
  }

  const modifiers = buildModifierBlock(settings);
  return parts.join('\n') + modifiers;
}

function generateHandoffPrompt(session, target, settings) {
  const parts = [];

  if (settings.systemContext) {
    parts.push(`[System context: ${settings.systemContext}]`);
    parts.push('');
  }

  let upcomingRound;
  if (session.round === 0) {
    upcomingRound = 1;
  } else if (target === session.startingAI) {
    const otherAI = target === 'claude' ? 'gemini' : 'claude';
    const currentRoundAIs = new Set(
      session.messages
        .filter((m) => m.round === session.round && (m.source === 'claude' || m.source === 'gemini'))
        .map((m) => m.source),
    );
    upcomingRound = currentRoundAIs.has(otherAI) ? session.round + 1 : session.round;
  } else {
    upcomingRound = session.round;
  }

  if (settings.brainstormMode) {
    parts.push(`=== BRAINSTORM — ROUND ${upcomingRound} ===`);
    parts.push(
      'Generative ideation between independent AI contributors. Build on every idea presented. Add novel directions the other contributor hasn\'t explored.',
    );
    parts.push(
      'Do not evaluate, critique, rank, or filter ideas. Volume and diversity over quality.',
    );
    parts.push(
      'Do NOT converge on recommendations, narrow to "top picks," or produce polished deliverables unless the user explicitly asks. Focus on expanding the possibility space.',
    );
    parts.push(
      'Focus on conceptual novelty. No abstract jargon as a substitute.',
    );
  } else {
    parts.push(`=== DIALECTIC — ROUND ${upcomingRound} ===`);
    parts.push(
      'Structured dialectic between independent AI analysts. Challenge errors, defend sound positions, update only when genuinely persuaded. Do not soften disagreements.',
    );
    parts.push(
      'Do NOT produce finished documents, specs, summaries, or deliverables unless the user explicitly asks. Focus on dialectic reasoning and decision-making.',
    );
  }
  parts.push('');

  const targetHasResponded = session.messages.some((m) => m.source === target);
  if (!targetHasResponded) {
    parts.push('--- INITIAL CONTEXT (msgid#1) ---');
    parts.push(session.initialContext);
  } else {
    parts.push('--- INITIAL CONTEXT (see msgid#1 in thread) ---');
  }
  parts.push('');

  const allMessages = session.messages;
  if (allMessages.length > 0) {
    let lastAIMsg = null;
    for (let i = allMessages.length - 1; i >= 0; i--) {
      if (allMessages[i].source === 'claude' || allMessages[i].source === 'gemini') {
        lastAIMsg = allMessages[i];
        break;
      }
    }

    const lastAIRound = lastAIMsg ? lastAIMsg.round : session.round;
    const threadId = (msgIndex) => msgIndex + 2;

    const priorRoundMsgs = allMessages
      .map((m, i) => ({ ...m, _threadId: threadId(i) }))
      .filter((m) => m.round < lastAIRound);
    if (priorRoundMsgs.length > 0) {
      parts.push('--- PRIOR ROUNDS (SUMMARY) ---');
      const rounds = {};
      for (const m of priorRoundMsgs) {
        const r = m.round || 0;
        if (!rounds[r]) rounds[r] = [];
        rounds[r].push(m);
      }
      for (const [roundNum, msgs] of Object.entries(rounds)) {
        const aiSources = [...new Set(msgs.filter((m) => m.source !== 'user').map((m) => capitalize(m.source)))];
        const userCount = msgs.filter((m) => m.source === 'user').length;
        const ids = msgs.map((m) => `msgid#${m._threadId}`).join(', ');
        let summary = `Round ${roundNum}: ${aiSources.join(', ')} responded (${ids})`;
        if (userCount > 0) {
          summary += ` (+ ${userCount} user interjection${userCount > 1 ? 's' : ''})`;
        }
        parts.push(summary);
      }
      parts.push('');
    }

    const currentRoundMsgs = allMessages
      .map((m, i) => ({ ...m, _threadId: threadId(i) }))
      .filter((m) => m.round >= lastAIRound);
    if (currentRoundMsgs.length > 0) {
      parts.push('--- THIS ROUND ---');
      const hasUserMsg = currentRoundMsgs.some((m) => m.source === 'user');
      if (hasUserMsg) {
        parts.push('NOTE: The user interjected during this round. Address their input directly.');
      }
      parts.push('');
      for (const m of currentRoundMsgs) {
        const src = m.source === 'user' ? 'User' : capitalize(m.source);
        if (m.source === target && targetHasResponded) {
          parts.push(`[${src}] (msgid#${m._threadId}): (your prior response — already in your context)`);
          parts.push('');
        } else {
          parts.push(`[${src}] (msgid#${m._threadId}):`);
          parts.push(m.content);
          parts.push('');
        }
      }
    }
  }

  parts.push('--- YOUR TASK ---');
  if (settings.brainstormMode) {
    parts.push('1. Build on, remix, and extend the ideas already generated — do not repeat them verbatim');
    parts.push('2. Add entirely new ideas the prior round missed');
    parts.push('3. Explore unexpected tangents, combinations, and creative leaps');
    parts.push('4. Tag each idea with a bracketed label (e.g., [Distribution], [UX], [Pricing])');
    parts.push('5. Do NOT evaluate, rank, or filter — quantity and variety over quality');
  } else {
    parts.push('1. Identify any errors, unsupported claims, or logical gaps in the above analysis');
    parts.push('2. Challenge assumptions you disagree with — explain why');
    parts.push('3. Defend your own prior positions where you believe they are correct');
    parts.push('4. Update your position only where genuinely persuaded by evidence or logic');
    parts.push('5. Provide your complete, honest assessment');
  }

  const modifiers = buildModifierBlock(settings);
  let prompt = parts.join('\n') + modifiers;

  if (settings.brainstormMode && target === 'gemini') {
    prompt += '\n\nOUTPUT ONLY THE REQUESTED LIST. NO PREAMBLE. NO CLOSING REMARKS. DO NOT ASK FOLLOW-UP QUESTIONS.';
  }

  return prompt;
}
