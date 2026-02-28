/**
 * AU World Builder — Core Module
 * Constants, prompt templates, utilities, settings management.
 */
(function (A) {
    'use strict';

    /* ══════════════════════════════════════════════
       Constants
       ══════════════════════════════════════════════ */
    A.extensionName = 'AU-World-Builder';
    A.MODULE_PREFIX = 'au_wb_';
    A.MAX_HISTORY   = 20;
    A.MAX_RETRIES   = 2;
    A.RETRY_BASE_MS = 2000;

    /* Built-in section definitions */
    A.BUILTIN_SECTIONS = [
        { id: 'world',           label: '세계관 배경',        tag: 'WORLD',             injHeader: 'AU World Setting' },
        { id: 'worldLife',       label: '일상/문화',          tag: 'WORLD_LIFE',        injHeader: 'AU Daily Life & Culture' },
        { id: 'worldRules',      label: '특수 설정',          tag: 'WORLD_RULES',       injHeader: 'AU Special Rules & Systems' },
        { id: 'charSetting',     label: '{{char}} 역할/설정', tag: 'CHAR',              injHeader: '{{char}} - AU Character Setting' },
        { id: 'charPersonality', label: '{{char}} 성격/내면', tag: 'CHAR_PERSONALITY',  injHeader: '{{char}} - Personality & Inner Self' },
        { id: 'userSetting',     label: '{{user}} 역할/설정', tag: 'USER',              injHeader: '{{user}} - AU Character Setting' },
        { id: 'userPersonality', label: '{{user}} 성격/내면', tag: 'USER_PERSONALITY',  injHeader: '{{user}} - Personality & Inner Self' },
        { id: 'charRelation',    label: '관계',               tag: 'CHAR_RELATION',     injHeader: '{{char}} & {{user}} - Relationship' },
        { id: 'charHistory',     label: '과거사',             tag: 'CHAR_HISTORY',      injHeader: '{{char}} & {{user}} - Shared History' },
        { id: 'charClothing',    label: '{{char}} 복장',      tag: 'CHAR_CLOTHING',     injHeader: '{{char}} - Current Clothing/Appearance' },
        { id: 'userClothing',    label: '{{user}} 복장',      tag: 'USER_CLOTHING',     injHeader: '{{user}} - Current Clothing/Appearance' },
    ];

    /* ══════════════════════════════════════════════
       Prompt Templates
       ══════════════════════════════════════════════ */
    A.DEFAULT_INITIAL_PROMPT = [
        'You are a master-class creative writer, worldbuilder, and narrative designer.',
        'Craft a deeply immersive, internally consistent AU (Alternate Universe).',
        '',
        '## CREATIVE DIRECTIVES',
        '{{GUIDELINES}}',
        '',
        '{{VOLUME_INSTRUCTION}}',
        '',
        '## AU Concept',
        '{{CONCEPT}}',
        '{{REFERENCE_BLOCK}}',
        '{{RELATIONSHIP_BLOCK}}',
        '',
        '## Source Character Information',
        '- Name: {{CHAR_NAME}}',
        '- Description: {{CHAR_DESC}}',
        '- Personality: {{CHAR_PERS}}',
        '- Scenario: {{CHAR_SCENE}}',
        '',
        '## Source User Information',
        '- Name: {{USER_NAME}}',
        '- Persona: {{USER_PERSONA}}',
        '',
        '## OUTPUT FORMAT — Follow EXACTLY with these markers',
        '',
        '{{OUTPUT_FORMAT}}',
        '',
        '{{LANG_INSTRUCTION}}',
    ].join('\n');

    A.DEFAULT_UPDATE_PROMPT = [
        'You are a skilled AU narrative editor with a keen eye for meaningful story evolution.',
        '',
        '## YOUR TASK',
        'Analyze the recent chat messages and update the AU settings to reflect significant developments.',
        '',
        '## UPDATE PRINCIPLES',
        '- PRESERVE the existing voice, tone, and writing quality — do not flatten or simplify.',
        '- Only MODIFY content when chat messages reveal genuine changes (e.g., relationship shifts, world-state changes, appearance updates).',
        '- ADD new details that emerged organically from the story.',
        '- Do NOT rewrite sections that had no relevant changes — reproduce them exactly.',
        '- Maintain internal consistency: if one section changes, ensure related sections still make sense.',
        '- Keep the same literary quality and sensory detail level as the originals.',
        '',
        '{{VOLUME_INSTRUCTION}}',
        '',
        '## Character Names',
        '- Character: {{CHAR_NAME}}',
        '- User: {{USER_NAME}}',
        '',
        '## EXISTING AU SETTINGS',
        '{{EXISTING_SETTINGS}}',
        '',
        '## RECENT CHAT MESSAGES (#{{START}} – #{{END}})',
        '{{MESSAGES}}',
        '',
        '## OUTPUT — Use the same tag format',
        '{{OUTPUT_FORMAT}}',
        '',
        '{{LANG_INSTRUCTION}}',
    ].join('\n');

    A.DEFAULT_GENRE_PROMPT = [
        'You are a literary analyst and creative writing coach.',
        'Analyze the AU world setting below and produce a precise genre/tone directive.',
        '',
        '## World Setting',
        '{{WORLD_SETTING}}',
        '',
        '## INSTRUCTIONS',
        'Write 2–4 sentences that capture:',
        '- Primary and secondary genres (e.g., slice-of-life romance with noir undertones)',
        '- Dominant mood and atmospheric texture (e.g., "warm summer haze with an undercurrent of dread")',
        '- Prose style direction (e.g., lyrical interior monologue, punchy dialogue-driven, atmospheric slow-burn)',
        '- Core thematic tensions (e.g., freedom vs. duty, intimacy vs. self-preservation)',
        '',
        'Be specific and evocative — this will guide all future writing in this AU.',
        '{{LANG_INSTRUCTION}}',
    ].join('\n');

    A.DEFAULT_SECTION_PROMPT = [
        'You are a master AU worldbuilder and creative writer.',
        'Regenerate ONLY the {{SECTION_LABEL}} section for this AU with fresh, higher-quality content.',
        '',
        '## REGENERATION STANDARDS',
        '- Write as polished creative prose, not a summary or outline.',
        '- Use vivid sensory details and specific, concrete descriptions.',
        '- Include at least one unexpected element, hidden connection, or narrative hook.',
        '- MUST remain internally consistent with all other existing sections.',
        '- If the section describes a character, give them contradictions and behavioral quirks.',
        '- If the section describes a world/setting, include social dynamics and atmosphere.',
        '',
        '{{VOLUME_INSTRUCTION}}',
        '',
        '## AU Concept: {{CONCEPT}}',
        '## Character: {{CHAR_NAME}} — {{CHAR_DESC}}',
        '## User: {{USER_NAME}} — {{USER_PERSONA}}',
        '',
        '## Current AU Settings (context — preserve consistency with these)',
        '{{EXISTING_SETTINGS}}',
        '',
        'Now regenerate ONLY the section below. Output the result wrapped in the tag markers.',
        '{{SECTION_TAG}}',
        '',
        '{{LANG_INSTRUCTION}}',
    ].join('\n');

    A.DEFAULT_PARTIAL_REGEN_PROMPT = [
        'You are a master AU worldbuilder and creative writer.',
        'You will rewrite ONLY a specific portion of the {{SECTION_LABEL}} section.',
        '',
        '## RULES',
        '- Rewrite ONLY the selected portion below. Do NOT touch content before or after it.',
        '- Maintain consistency with all other sections and surrounding context.',
        '- Follow the user instruction if provided, otherwise improve quality and detail.',
        '- Output ONLY the rewritten portion (no tags, no surrounding text).',
        '',
        '{{VOLUME_INSTRUCTION}}',
        '',
        '## Full Section Content (context)',
        '{{FULL_CONTENT}}',
        '',
        '## Selected Portion to Rewrite',
        '{{SELECTED_TEXT}}',
        '',
        '## User Instruction',
        '{{USER_INSTRUCTION}}',
        '',
        '{{LANG_INSTRUCTION}}',
    ].join('\n');

    A.DEFAULT_CONSISTENCY_CHECK_PROMPT = [
        'You are a meticulous AU consistency auditor.',
        'Analyze the following AU world settings for internal contradictions, logical inconsistencies, or gaps.',
        '',
        '## ALL CURRENT SETTINGS',
        '{{ALL_SETTINGS}}',
        '',
        '## CHECK CRITERIA',
        '- Contradictions between sections (e.g., timeline conflicts, personality clashes)',
        '- Logical impossibilities within the AU premise',
        '- Missing connections that should exist given established facts',
        '- Character behavior inconsistencies across different sections',
        '',
        '## OUTPUT FORMAT',
        'List each issue found as:',
        '[ISSUE] Section1 ↔ Section2: Brief description of the inconsistency',
        '[SUGGESTION] How to resolve it',
        '',
        'If no issues found, respond with: [CONSISTENT] All sections are internally consistent.',
        '',
        '{{LANG_INSTRUCTION}}',
    ].join('\n');

    A.DEFAULT_SMART_ANALYSIS_PROMPT = [
        'You are a precise narrative analyst. Your job is to determine whether recent chat messages contain developments that require AU world settings to be updated.',
        '',
        '## Current AU Summary',
        '{{WORLD_SUMMARY}}',
        '',
        '## Recent Messages (#{{START}} – #{{END}})',
        '{{MESSAGES}}',
        '',
        '## ANALYSIS CRITERIA',
        'An update is NEEDED only if messages contain:',
        '- A significant relationship shift (confession, betrayal, new alliance)',
        '- A world-state change (location destroyed, new rule established, season changed)',
        '- A character revelation (hidden identity revealed, power awakened, major decision)',
        '- A permanent appearance change (new outfit established, injury, transformation)',
        '',
        'An update is NOT needed for:',
        '- Normal dialogue or emotional reactions within existing dynamics',
        '- Temporary actions that don\'t change the status quo',
        '- Internal thoughts that don\'t lead to external change',
        '',
        'Reply with EXACTLY one of:',
        '- UPDATE_NEEDED: <brief reason>',
        '- NO_UPDATE_NEEDED',
    ].join('\n');

    A.DEFAULT_BRAINSTORM_PROMPT = [
        'You are a visionary creative director specializing in alternate universe concepts.',
        'Based on the seed idea below, propose EXACTLY 3 wildly different AU directions.',
        '',
        '## BRAINSTORM RULES',
        '- Each idea MUST be genuinely distinct in genre, tone, or premise — not variations of the same theme.',
        '- Each idea must have a clear narrative hook: a central tension, mystery, or dramatic question.',
        '- Ideas should leverage the characters\' unique traits in surprising ways.',
        '- Avoid generic setups (e.g., "coffee shop AU" without a twist). Every concept needs a unique angle.',
        '- Avoid textbook tropes, predictable premises, or clichéd setups. Push past the obvious first idea.',
        '- **BE CONCISE**: Each summary must be exactly 1–2 sentences. Do NOT elaborate or add details beyond the core hook.',
        '',
        '## Seed Concept',
        '{{CONCEPT}}',
        '{{REFERENCE_BLOCK}}',
        '',
        '## Characters',
        '- {{CHAR_NAME}}: {{CHAR_DESC}}',
        '- {{USER_NAME}}: {{USER_PERSONA}}',
        '',
        '{{GUIDELINES}}',
        '',
        'For each concept, output in this EXACT format:',
        '[IDEA_1]',
        'Title: (short evocative title)',
        'Summary: (1–2 sentences ONLY: the core premise and dramatic hook. No more.)',
        '[/IDEA_1]',
        '',
        '[IDEA_2]',
        'Title: ...',
        'Summary: (1–2 sentences ONLY)',
        '[/IDEA_2]',
        '',
        '[IDEA_3]',
        'Title: ...',
        'Summary: (1–2 sentences ONLY)',
        '[/IDEA_3]',
        '',
        '{{LANG_INSTRUCTION}}',
    ].join('\n');

    A.DEFAULT_REFINE_PROMPT = [
        'You are a senior creative editor with a gift for elevating prose.',
        'Refine ONLY the {{SECTION_LABEL}} section, applying the direction below.',
        '',
        '## REFINEMENT STANDARDS',
        '- Upgrade the writing quality: stronger verbs, more precise imagery, better rhythm.',
        '- Preserve the original meaning, tone, and factual content unless the direction asks otherwise.',
        '- Maintain perfect consistency with all other AU sections.',
        '- The refined version should feel like a natural evolution, not a rewrite from scratch.',
        '- Preserve the approximate length unless the direction asks to expand or condense.',
        '',
        '## Refinement Direction',
        '{{DIRECTION}}',
        '',
        '## Current Content',
        '{{CURRENT_CONTENT}}',
        '',
        '## Full AU Context (for consistency)',
        '{{EXISTING_SETTINGS}}',
        '',
        'Output ONLY the refined content, wrapped in:',
        '{{SECTION_TAG}}',
        '',
        '{{LANG_INSTRUCTION}}',
    ].join('\n');

    A.DEFAULT_WHATIF_PROMPT = [
        'You are a master of alternate scenarios and butterfly-effect storytelling.',
        'Transform the existing AU based on a "What-If" divergence point.',
        '',
        '## WHAT-IF PRINCIPLES',
        '- Trace the ripple effects of the premise logically through every section.',
        '- Characters should still be recognizable but authentically changed by the altered circumstances.',
        '- The world should feel like a coherent alternate reality, not a random reshuffle.',
        '- Preserve the literary quality and sensory detail of the originals.',
        '- Highlight what\'s eerily similar AND what\'s dramatically different.',
        '',
        '{{VOLUME_INSTRUCTION}}',
        '',
        '## What-If Premise',
        '{{WHATIF_PREMISE}}',
        '',
        '## Current AU Settings (the baseline to diverge from)',
        '{{EXISTING_SETTINGS}}',
        '',
        '## Characters',
        '- {{CHAR_NAME}}: {{CHAR_DESC}}',
        '- {{USER_NAME}}: {{USER_PERSONA}}',
        '',
        '## OUTPUT FORMAT',
        '{{OUTPUT_FORMAT}}',
        '',
        '{{LANG_INSTRUCTION}}',
    ].join('\n');

    A.DEFAULT_SKELETON_PROMPT = [
        'You are a master narrative architect. Build a SKELETON OUTLINE for an AU.',
        'For each section, write 2–3 concise bullet points that establish:',
        '- The core idea and unique angle',
        '- A hidden connection or narrative thread linking to other sections',
        '- One surprising detail or hook',
        '',
        '## CREATIVE DIRECTIVES',
        '{{GUIDELINES}}',
        '',
        '## AU Concept',
        '{{CONCEPT}}',
        '{{REFERENCE_BLOCK}}',
        '{{RELATIONSHIP_BLOCK}}',
        '',
        '## Characters',
        '- {{CHAR_NAME}}: {{CHAR_DESC}}',
        '- {{USER_NAME}}: {{USER_PERSONA}}',
        '',
        '## OUTPUT — Use these tag markers, bullet points only',
        '{{OUTPUT_FORMAT}}',
        '',
        '{{LANG_INSTRUCTION}}',
    ].join('\n');

    A.DEFAULT_SELF_CRITIQUE_PROMPT = [
        'You are a harsh but constructive literary critic.',
        'Review the AU content below and identify the TOP 3 weakest sections.',
        '',
        '## EVALUATION CRITERIA',
        '- Originality: Does the section avoid clichés and generic ideas?',
        '- Specificity: Are details concrete and vivid, or vague placeholders?',
        '- Interconnection: Does it meaningfully connect to other sections?',
        '- Narrative Hook: Does it create curiosity or dramatic tension?',
        '- Internal Logic: Is it consistent with the AU premise?',
        '',
        '## ALL CURRENT SETTINGS',
        '{{ALL_SETTINGS}}',
        '',
        '## OUTPUT FORMAT',
        'For each weak section, output EXACTLY:',
        '[CRITIQUE_1]',
        'Section: (section id, e.g. world, charSetting, charPersonality)',
        'Problem: (1 sentence)',
        'Fix: (1 sentence suggestion)',
        '[/CRITIQUE_1]',
        '',
        '[CRITIQUE_2]',
        '...',
        '[/CRITIQUE_2]',
        '',
        '[CRITIQUE_3]',
        '...',
        '[/CRITIQUE_3]',
        '',
        'If the content is already excellent, reply: [NO_ISSUES]',
        '',
        '{{LANG_INSTRUCTION}}',
    ].join('\n');

    /* ══════════════════════════════════════════════
       Concept Idea Library & Random Combo Builder
       ══════════════════════════════════════════════ */
    A.CONCEPT_LIBRARY = [
        { cat: '일상/로맨스', items: [
            '현대 카페 AU — 단골손님과 바리스타의 느린 거리 좁히기',
            '대학교 AU — 같은 과 선후배, 도서관에서 자주 마주치는 사이',
            '룸메이트 AU — 성격이 정반대인 두 사람의 공동생활',
            '소꿉친구 AU — 오랫동안 친구였지만 어느 날 감정이 흔들리기 시작',
            '직장 동료 AU — 매일 마주치는 사무실, 야근이 만든 미묘한 분위기',
            '온라인 친구 AU — 서로의 정체를 모른 채 현실에서도 이미 아는 사이',
            '이웃집 AU — 벽 하나 사이, 소리로 먼저 알게 된 상대방의 생활',
        ]},
        { cat: '판타지', items: [
            '마법학원 AU — 금지된 마법을 함께 연구하게 된 두 사람',
            '요정/인간 AU — 인간 세계에 호기심을 품은 요정과의 공존',
            '드래곤 라이더 AU — 적대 진영의 기수들이 전장에서 만나다',
            '저주받은 성 AU — 저주를 풀 열쇠가 서로에게 있다는 걸 알게 된 후',
            '정령 계약 AU — 계약 관계로 시작했지만 점점 경계가 흐려지는',
            '이세계 전이 AU — 현대인이 판타지 세계에 떨어졌고, 그곳의 주민이 가이드가 되어',
        ]},
        { cat: 'SF/미래', items: [
            '우주 정거장 AU — 고립된 우주에서 유일한 동료와 생존',
            '사이버펑크 AU — 네온 가득한 언더시티에서 의뢰를 함께 받는 파트너',
            '안드로이드 AU — 인간을 돌보는 AI가 감정을 이해하기 시작하다',
            '타임루프 AU — 같은 하루를 반복하면서 상대방만이 기억을 공유',
            '디스토피아 AU — 감정이 금지된 세계에서 몰래 느끼기 시작한 것',
            '가상현실 AU — 게임 속에서만 만나던 두 사람이 현실에서 마주칠 때',
        ]},
        { cat: '역사/시대극', items: [
            '빅토리안 AU — 사교계의 규범 속, 신분을 넘은 비밀스러운 만남',
            '1920년대 재즈 시대 AU — 금주법 시대 스피크이지에서 만난 두 사람',
            '조선시대 AU — 신분 차이를 넘은 비밀스러운 교류',
            '2차대전 AU — 전쟁 속에서 서로 다른 진영의 사람들이 만나다',
            '해적 시대 AU — 바다 위의 자유와 보물, 그리고 예상치 못한 동맹',
        ]},
        { cat: '다크/앵스트', items: [
            '느와르 탐정 AU — 어둠 속 진실을 추적하며 서로를 신뢰해야 하는',
            '뱀파이어 AU — 포식자와 먹이의 관계가 뒤틀려 의존으로 변해가는',
            '포스트 아포칼립스 AU — 문명 붕괴 후, 살아남은 자들의 동행',
            '기억상실 AU — 모든 것을 잃은 채 상대방이 건네는 과거의 조각들',
            '마피아 AU — 조직의 규율과 개인의 감정 사이에서 갈등하는',
            '감금/탈출 AU — 함께 갇힌 상황에서 탈출을 도모하며 쌓이는 신뢰',
        ]},
        { cat: '직업/상황', items: [
            '아이돌/매니저 AU — 대중 앞의 완벽한 모습 뒤에 숨은 진짜 관계',
            '의사/환자 AU — 전문적 거리감과 개인적 감정의 경계',
            '선생/학생 AU — 금기의 경계에서 흔들리는 멘토-멘티 관계',
            '라이벌 밴드 AU — 음악 배틀에서 부딪히지만 서로의 재능을 인정',
            '범죄자/형사 AU — 쫓고 쫓기는 관계 속의 기묘한 존중',
            '요리사 경쟁 AU — 요리 대회에서 라이벌이 된 두 사람',
        ]},
        { cat: '코미디/힐링', items: [
            '바디 스왑 AU — 서로의 몸이 바뀌어 상대방의 일상을 경험',
            '슈퍼파워 AU — 쓸모없어 보이는 능력을 가진 둘이 의외의 궁합 발견',
            '동물변신 AU — 갑자기 동물로 변해버린 작은 해프닝과 돌봄',
            '유령 동거 AU — 이사한 집에 유령이 살고 있었고, 의외로 좋은 룸메이트',
            '소원성취 AU — 우연히 소원을 이루는 능력을 얻었지만 대가가 따르는',
        ]},
    ];

    /* Random combo builder slots (expanded) */
    A.COMBO_SETTINGS = [
        '현대 도시', '시골 마을', '우주 정거장', '판타지 왕국', '해저 도시', '마법학원',
        '사이버펑크 거리', '빅토리안 저택', '전쟁터', '무인도', '지하 미궁', '떠도는 방랑길',
        '폐허가 된 놀이공원', '밤의 도서관', '꿈 속 세계', '열차 안',
        '1920년대 재즈바', '고대 신전', '가상현실 게임', '비밀 지하조직',
        '극지방 연구기지', '사막 오아시스', '떠다니는 섬', '지하철 미궁',
        '봉인된 탑', '항구 도시', '유령 저택', '시간이 멈춘 마을',
        '공중 정원', '화산 옆 온천마을', '이동하는 성', '학교 옥상',
        '심해 잠수함', '빗속의 네온 골목', '유적 도시', '달 기지',
        '지구 밖 식민지', '바다 위 부유도시', '산속 수도원', '인형극장',
    ];
    A.COMBO_RELATIONS = [
        '첫 만남', '소꿉친구', '라이벌', '주종관계', '동업자', '보호자/피보호자',
        '전 연인', '원수→동맹', '가짜 연인', '스승/제자', '계약 관계',
        '감시자/감시대상', '의뢰인/해결사', '공범', '서로 모르는 이웃',
        '쫓고 쫓기는 관계', '일방적 팬→아이돌', '쌍둥이/도플갱어',
        '형제/자매', '상관과 부하', '인질/구출자', '온라인 펜팔',
        '전생의 인연', '약혼자(정략)', '어릴 적 은인', '사기꾼과 피해자',
        '실험체/연구자', '유령과 생자', '프로그래머/AI', '의사/간호사 동료',
        '해적/포로', '경비원/침입자', '사냥꾼/사냥감', '왕자/하인',
        '밀수꾼/세관원', '예술가/뮤즈', '방송인/시청자', '구조대원/조난자',
        '점술사/운명을 바꾸고 싶은 자', '불사자/필멸자',
    ];
    A.COMBO_TWISTS = [
        '기억을 공유하는 저주', '한쪽만 시간이 흐르는 세계', '비밀 정체 발각 위기',
        '세계 멸망까지 7일', '감정을 들킬 수 없는 규칙', '거짓말하면 상처를 입는 저주',
        '매일 밤 기억이 리셋됨', '상대가 보이지 않는 존재', '서로의 약점을 쥐고 있는',
        '사실 같은 사건의 목격자', '꿈에서만 만남', '서로 다른 시간대에 삶',
        '한쪽이 인간이 아님', '예언에 얽힌 운명', '감금/폐쇄 공간 탈출',
        '서로의 기억 속에 진실이 숨어 있음', '죽으면 되돌아오는 루프',
        '만지면 감정이 전달됨', '타인의 눈으로 세상을 보는 능력',
        '하루에 한 번만 대화 가능', '특정 장소에서만 만날 수 있음',
        '이름을 부르면 저주가 발동', '서로의 수명이 연결됨',
        '한쪽이 점점 투명해짐', '감정을 느끼면 꽃이 핌',
        '밤에만 존재하는 세계', '거울 속에만 존재하는 상대',
        '비밀을 말하면 하늘이 무너짐', '한쪽이 다른 시대에서 왔음',
        '음악이 마법의 매개체', '동물로 변하는 저주',
        '감정을 색으로 볼 수 있는 눈', '두 세계가 겹치는 시간',
        '한 달에 한 번 기억이 섞임', '상처가 상대에게 전이됨',
        '선택에 따라 세계가 분기', '말한 것이 현실이 됨',
        '사진을 찍으면 미래가 보임', '비오는 날만 능력이 발동',
    ];

    /* ══════════════════════════════════════════════
       Default Settings
       ══════════════════════════════════════════════ */
    A.newSectionCfg = function () {
        return { enabled: true, locked: false, injPos: 1, injDepth: 4, injRole: 0 };
    };

    A.defaultSettings = {
        enabled: true,
        apiSource: 'sillytavern',
        connectionProfile: '',
        customApiUrl: '',
        customApiKey: '',
        customApiModel: '',
        customApiMaxTokens: 4000,
        customApiTimeout: 600,
        autoUpdateEnabled: false,
        autoUpdateInterval: 5,
        smartAutoUpdate: true,
        genrePromptEnabled: false,
        debugMode: false,
        outputLanguage: 'korean',
        presets: [],
        chatData: {},
        genOptions: {
            cliche: 'allow', relation: 'first', original: 'loose', mood: 'light',
            detailDepth: 'normal', conflict: 'subtle', outputVolume: 'medium',
            genreTags: [], customGenres: [],
            styleTags: [], customStyles: [],
            eraTags: [], customEras: [],
            twoPassEnabled: false,
            selfCritiqueEnabled: false,
            sequentialEnabled: false,
            themeAnchor: '',
            dramaticQuestion: '',
            mustInclude: '',
            mustExclude: '',
            sectionDirectives: {},
            sourceDetailEnabled: false,
            sourceDetailAspects: {
                name: true, personality: true, age: false,
                appearance: false, abilities: false,
                background: false, relationships: false
            },
        },
        sectionConfig: {
            world:           A.newSectionCfg(),
            worldLife:       A.newSectionCfg(),
            worldRules:      A.newSectionCfg(),
            charSetting:     A.newSectionCfg(),
            charPersonality: A.newSectionCfg(),
            userSetting:     A.newSectionCfg(),
            userPersonality: A.newSectionCfg(),
            charRelation:    A.newSectionCfg(),
            charHistory:     A.newSectionCfg(),
            charClothing:    A.newSectionCfg(),
            userClothing:    A.newSectionCfg(),
            genre:           A.newSectionCfg(),
        },
        customSections: [],
        customPrompts: { initial: '', update: '', genre: '', section: '', smartAnalysis: '', brainstorm: '', refine: '', whatif: '' },
        customRefineDirections: [],
        sectionOrder: [],
        userComboSettings: [],
        userComboRelations: [],
        userComboTwists: [],
        deletedComboSettings: [],
        deletedComboRelations: [],
        deletedComboTwists: [],
        moodPresets: [],
    };

    /* ══════════════════════════════════════════════
       Utility Helpers
       ══════════════════════════════════════════════ */
    A.log = function () {
        console.log('[' + A.extensionName + ']', ...arguments);
    };

    A.logError = function () {
        console.error('[' + A.extensionName + ']', ...arguments);
    };

    var _escDiv = document.createElement('div');
    A.escapeHtml = function (text) {
        _escDiv.textContent = text;
        return _escDiv.innerHTML;
    };

    A.debounce = function (fn, delay) {
        var tid;
        return function () {
            var ctx = this, args = arguments;
            clearTimeout(tid);
            tid = setTimeout(function () { fn.apply(ctx, args); }, delay);
        };
    };

    A.estimateTokens = function (text) {
        if (!text) return 0;
        var cjk = (text.match(/[\u3000-\u9fff\uac00-\ud7af\uff00-\uffef]/g) || []).length;
        return Math.ceil(cjk * 0.7 + (text.length - cjk) / 4);
    };

    A.escapeRegex = function (s) {
        return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    };

    A.cleanSection = function (text) {
        return (text || '').replace(/^#+\s*.+$/m, '').replace(/^---+$/gm, '').trim();
    };

    A.fillTemplate = function (tmpl, vars) {
        for (var k in vars) {
            tmpl = tmpl.split('{{' + k + '}}').join(vars[k] || '');
        }
        return tmpl;
    };

    /**
     * Line-level LCS diff (feature C).
     * Returns array of { type:'same'|'added'|'removed', text:string }.
     */
    /**
     * Optimized line-level diff.
     * Trims common prefix/suffix before running LCS on the (smaller) middle.
     * Safety cap prevents huge DP allocations.
     */
    A.diffLines = function (oldText, newText) {
        if (oldText === newText) {
            return oldText ? oldText.split('\n').map(function (l) { return { type: 'same', text: l }; }) : [];
        }
        var oL = (oldText || '').split('\n');
        var nL = (newText || '').split('\n');

        /* Trim common prefix */
        var pLen = 0, mn = Math.min(oL.length, nL.length);
        while (pLen < mn && oL[pLen] === nL[pLen]) pLen++;

        /* Trim common suffix */
        var sLen = 0;
        while (sLen < (oL.length - pLen) && sLen < (nL.length - pLen)
               && oL[oL.length - 1 - sLen] === nL[nL.length - 1 - sLen]) sLen++;

        var same = function (l) { return { type: 'same', text: l }; };
        var prefix = oL.slice(0, pLen).map(same);
        var suffix = sLen ? oL.slice(oL.length - sLen).map(same) : [];
        var mO = oL.slice(pLen, oL.length - sLen);
        var mN = nL.slice(pLen, nL.length - sLen);

        if (!mO.length && !mN.length) return prefix.concat(suffix);
        if (!mO.length) return prefix.concat(mN.map(function (l) { return { type: 'added', text: l }; }), suffix);
        if (!mN.length) return prefix.concat(mO.map(function (l) { return { type: 'removed', text: l }; }), suffix);

        var m = mO.length, n = mN.length;
        /* Safety cap — very large diffs use simple remove+add */
        if (m * n > 250000) {
            return prefix
                .concat(mO.map(function (l) { return { type: 'removed', text: l }; }))
                .concat(mN.map(function (l) { return { type: 'added', text: l }; }))
                .concat(suffix);
        }

        /* LCS on trimmed middle */
        var dp = new Array(m + 1);
        for (var i = 0; i <= m; i++) dp[i] = new Uint16Array(n + 1);
        for (var i = 1; i <= m; i++) {
            for (var j = 1; j <= n; j++) {
                dp[i][j] = mO[i - 1] === mN[j - 1]
                    ? dp[i - 1][j - 1] + 1
                    : (dp[i - 1][j] > dp[i][j - 1] ? dp[i - 1][j] : dp[i][j - 1]);
            }
        }
        var mid = [], ii = m, jj = n;
        while (ii > 0 || jj > 0) {
            if (ii > 0 && jj > 0 && mO[ii - 1] === mN[jj - 1]) {
                mid.unshift({ type: 'same', text: mO[ii - 1] }); ii--; jj--;
            } else if (jj > 0 && (!ii || dp[ii][jj - 1] >= dp[ii - 1][jj])) {
                mid.unshift({ type: 'added', text: mN[jj - 1] }); jj--;
            } else {
                mid.unshift({ type: 'removed', text: mO[ii - 1] }); ii--;
            }
        }
        return prefix.concat(mid, suffix);
    };

    /* ══════════════════════════════════════════════
       Settings Management
       ══════════════════════════════════════════════ */
    var _settingsCache = null;
    var _migrationDone = false;

    A.getSettings = function () {
        if (_settingsCache) return _settingsCache;

        var ext;
        try {
            var ctx = SillyTavern.getContext();
            ext = ctx && ctx.extensionSettings;
        } catch (_) {}
        ext = ext || window.extension_settings || {};
        window.extension_settings = ext;

        if (!ext[A.extensionName]) ext[A.extensionName] = {};
        var s = ext[A.extensionName];

        for (var k in A.defaultSettings) {
            if (s[k] === undefined) {
                s[k] = (typeof A.defaultSettings[k] === 'object' && A.defaultSettings[k] !== null)
                    ? JSON.parse(JSON.stringify(A.defaultSettings[k]))
                    : A.defaultSettings[k];
            }
        }

        if (!_migrationDone) {
            A.migrateV2(s);
            _migrationDone = true;
        }

        _settingsCache = s;
        return s;
    };

    /** Invalidate settings cache (called when context might change) */
    A.invalidateSettingsCache = function () { _settingsCache = null; };

    /**
     * Migrate from v2.0 (sectionToggles + global injection) → v2.1 (per-section config).
     */
    A.migrateV2 = function (s) {
        if (s.sectionToggles && !s._mig21) {
            var ot  = s.sectionToggles;
            var pos = s.injectionPosition != null ? s.injectionPosition : 1;
            var dep = s.injectionDepth    != null ? s.injectionDepth    : 4;
            var rol = s.injectionRole     != null ? s.injectionRole     : 0;

            if (!s.sectionConfig) s.sectionConfig = {};

            ['world', 'charSetting', 'userSetting', 'charClothing', 'userClothing', 'genre'].forEach(function (k) {
                if (!s.sectionConfig[k]) s.sectionConfig[k] = {};
                s.sectionConfig[k].enabled  = ot[k] !== false;
                s.sectionConfig[k].injPos   = pos;
                s.sectionConfig[k].injDepth = dep;
                s.sectionConfig[k].injRole  = rol;
            });

            delete s.sectionToggles;
            delete s.injectionPosition;
            delete s.injectionDepth;
            delete s.injectionRole;
            s._mig21 = true;
        }

        /* Clear legacy single-module prompt (once) */
        if (!s._legacyCleared) {
            try { SillyTavern.getContext().setExtensionPrompt('au_world_builder_injection', '', -1, 0); } catch (_) {}
            s._legacyCleared = true;
        }

        if (!s.customSections) s.customSections = [];
        if (!s.sectionConfig)  s.sectionConfig  = {};

        if (!s._secCfgReady) {
            ['world', 'charSetting', 'userSetting', 'charClothing', 'userClothing', 'genre'].forEach(function (k) {
                if (!s.sectionConfig[k]) s.sectionConfig[k] = A.newSectionCfg();
            });
            s._secCfgReady = true;
        }

        /* v2.2 migration: expand genOptions with new defaults */
        if (s.genOptions) {
            if (s.genOptions.relation === 'known') s.genOptions.relation = 'friend';
            if (s.genOptions.detailDepth === undefined) s.genOptions.detailDepth = 'normal';
            if (s.genOptions.conflict === undefined)    s.genOptions.conflict = 'subtle';
            if (s.genOptions.outputVolume === undefined) s.genOptions.outputVolume = 'medium';
            if (!Array.isArray(s.genOptions.genreTags))  s.genOptions.genreTags = [];
            if (!Array.isArray(s.genOptions.customGenres)) s.genOptions.customGenres = [];
            if (!Array.isArray(s.genOptions.styleTags))  s.genOptions.styleTags = [];
            if (!Array.isArray(s.genOptions.customStyles)) s.genOptions.customStyles = [];
            if (!Array.isArray(s.genOptions.eraTags))    s.genOptions.eraTags = [];
            if (!Array.isArray(s.genOptions.customEras))  s.genOptions.customEras = [];
            if (s.genOptions.twoPassEnabled === undefined)      s.genOptions.twoPassEnabled = false;
            if (s.genOptions.selfCritiqueEnabled === undefined) s.genOptions.selfCritiqueEnabled = false;
            if (s.genOptions.sequentialEnabled === undefined)   s.genOptions.sequentialEnabled = false;
            if (s.genOptions.themeAnchor === undefined)     s.genOptions.themeAnchor = '';
            if (s.genOptions.dramaticQuestion === undefined) s.genOptions.dramaticQuestion = '';
            if (s.genOptions.mustInclude === undefined) s.genOptions.mustInclude = '';
            if (s.genOptions.mustExclude === undefined) s.genOptions.mustExclude = '';
            if (!s.genOptions.sectionDirectives) s.genOptions.sectionDirectives = {};
            if (s.genOptions.sourceDetailEnabled === undefined) s.genOptions.sourceDetailEnabled = false;
            if (!s.genOptions.sourceDetailAspects) s.genOptions.sourceDetailAspects = {
                name: true, personality: true, age: false,
                appearance: false, abilities: false,
                background: false, relationships: false
            };
            /* Rename legacy tag */
            ['genreTags', 'customGenres'].forEach(function (k) {
                var idx = s.genOptions[k].indexOf('앙스트');
                if (idx !== -1) s.genOptions[k][idx] = '앵스트';
            });
        }

        /* v2.3 migration */
        if (!Array.isArray(s.customRefineDirections)) s.customRefineDirections = [];
        if (!Array.isArray(s.sectionOrder)) s.sectionOrder = [];

        /* v2.4 migration: bump old timeout defaults to 600 */
        if (s.customApiTimeout && s.customApiTimeout <= 300) s.customApiTimeout = 600;
    };

    var _saveQueued = false;
    A.saveSettings = function () {
        if (_saveQueued) return;
        _saveQueued = true;
        requestAnimationFrame(function () {
            _saveQueued = false;
            try {
                var ctx = SillyTavern.getContext();
                if (ctx && ctx.saveSettingsDebounced) { ctx.saveSettingsDebounced(); return; }
            } catch (_) {}
            if (typeof saveSettingsDebounced === 'function') saveSettingsDebounced();
        });
    };

    /* ══════════════════════════════════════════════
       Chat-Data Helpers
       ══════════════════════════════════════════════ */
    A.chatSpecificKeys = [
        'worldSetting', 'characterSettings', 'clothingStyles',
        'genrePrompt', 'auConcept', 'history', 'customSectionData',
        'reference', 'relationship', 'whatIfBranches',
    ];

    A.getCurrentChatId = function () {
        try {
            var ctx = SillyTavern.getContext();
            if (ctx.chatId) return ctx.chatId;
            if (ctx.chat_metadata && ctx.chat_metadata.chat_id) return ctx.chat_metadata.chat_id;
            if (ctx.characters && ctx.characterId != null) {
                return (ctx.characters[ctx.characterId]?.name || 'unk') + '_' + (ctx.chatId || 'def');
            }
        } catch (_) {}
        return null;
    };

    A.getChatData = function () {
        var id = A.getCurrentChatId();
        if (!id) return {};
        var s = A.getSettings();
        return (s.chatData && s.chatData[id]) || {};
    };

    A.saveChatData = function (key, value) {
        var id = A.getCurrentChatId();
        if (!id) return;
        var s = A.getSettings();
        if (!s.chatData)     s.chatData = {};
        if (!s.chatData[id]) s.chatData[id] = {};
        s.chatData[id][key] = value;
        A.saveSettings();
    };

    /* Keys that affect prompt injection — only these trigger updateExtensionPrompt */
    var _injKeys = [
        'enabled', 'genrePromptEnabled', 'sectionConfig',
        'worldSetting', 'characterSettings', 'clothingStyles',
        'genrePrompt', 'customSectionData',
    ];

    A.saveSetting = function (key, value) {
        if (A.chatSpecificKeys.indexOf(key) !== -1) {
            A.saveChatData(key, value);
        } else {
            A.getSettings()[key] = value;
            A.saveSettings();
        }
        if (_injKeys.indexOf(key) !== -1) {
            A.updateExtensionPrompt();
        }
    };

    /* ══════════════════════════════════════════════
       DOM Helpers
       ══════════════════════════════════════════════ */
    A.setVal = function (id, v) {
        var el = document.getElementById(id);
        if (el) el.value = v;
    };

    A.getElVal = function (id) {
        var el = document.getElementById(id);
        return el ? el.value : '';
    };

    A.setChecked = function (id, v) {
        var el = document.getElementById(id);
        if (el) el.checked = !!v;
    };

    A.setSelectVal = function (id, v) {
        var el = document.getElementById(id);
        if (el) el.value = v;
    };

})(window.AUWB);
