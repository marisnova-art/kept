/* Kept — Writing templates: ready-made layouts that show how the formatting tools can be combined.
   Only markup the sanitizer allows: p, h2, h3, ul, ol, li, blockquote, b, i, u, s, mark and span classes
   (c-*, hl-*, bg-*, fs-*, ico). Each template has a Korean and an English body. */
const ico = n => `<span class="ico" data-ico="${n}"></span>`;
const TEMPLATES = [
  {
    id: 'journal', icon: 'feather',
    name: { ko: '오늘의 일기', en: 'Daily journal' },
    desc: { ko: '기분 · 있었던 일 · 감사한 것', en: 'Mood · what happened · gratitude' },
    html: {
      ko: `<h2>오늘 하루</h2><p><b>기분</b> <mark class="hl-yellow">맑음</mark> · <span class="c-gray">한 단어로 적어 보세요</span></p><h3>${ico('sun-medium')} 있었던 일</h3><p>오늘 가장 기억에 남는 장면은…</p><h3>${ico('heart')} 감사한 것 세 가지</h3><ol><li></li><li></li><li></li></ol><blockquote>내일의 나에게 한마디</blockquote>`,
      en: `<h2>Today</h2><p><b>Mood</b> <mark class="hl-yellow">Sunny</mark> · <span class="c-gray">one word is enough</span></p><h3>${ico('sun-medium')} What happened</h3><p>The moment I remember most…</p><h3>${ico('heart')} Three good things</h3><ol><li></li><li></li><li></li></ol><blockquote>A note to tomorrow's me</blockquote>`
    }
  },
  {
    id: 'meeting', icon: 'users',
    name: { ko: '회의 노트', en: 'Meeting notes' },
    desc: { ko: '참석자 · 안건 · 결정 · 할 일', en: 'People · agenda · decisions · actions' },
    html: {
      ko: `<h2>회의 제목</h2><p><b>일시</b> <span class="c-gray">날짜, 시간</span><br><b>참석</b> <span class="c-gray">이름</span></p><h3>${ico('list-checks')} 안건</h3><ol><li></li><li></li></ol><h3>${ico('circle-check')} 결정한 것</h3><p><mark class="bg-green">결정 내용을 한 문장으로</mark></p><h3>${ico('flag')} 할 일</h3><ul><li><b>누가</b> · 무엇을 · <span class="c-red">언제까지</span></li></ul>`,
      en: `<h2>Meeting title</h2><p><b>When</b> <span class="c-gray">date, time</span><br><b>Who</b> <span class="c-gray">names</span></p><h3>${ico('list-checks')} Agenda</h3><ol><li></li><li></li></ol><h3>${ico('circle-check')} Decisions</h3><p><mark class="bg-green">One sentence per decision</mark></p><h3>${ico('flag')} Action items</h3><ul><li><b>Who</b> · what · <span class="c-red">by when</span></li></ul>`
    }
  },
  {
    id: 'priorities', icon: 'target',
    name: { ko: '오늘의 우선순위', en: 'Today\'s priorities' },
    desc: { ko: '꼭 · 하면 좋은 것 · 나중에', en: 'Must · nice to have · later' },
    html: {
      ko: `<h2>오늘 할 일</h2><h3><span class="c-red">● 꼭 해야 할 것</span></h3><ul><li></li></ul><h3><span class="c-amber">● 하면 좋은 것</span></h3><ul><li></li></ul><h3><span class="c-gray">● 나중에</span></h3><ul><li></li></ul><blockquote>하나를 끝내면 다음 하나만 봅니다.</blockquote>`,
      en: `<h2>Today</h2><h3><span class="c-red">● Must do</span></h3><ul><li></li></ul><h3><span class="c-amber">● Nice to have</span></h3><ul><li></li></ul><h3><span class="c-gray">● Later</span></h3><ul><li></li></ul><blockquote>Finish one, then look at the next.</blockquote>`
    }
  },
  {
    id: 'idea', icon: 'lightbulb',
    name: { ko: '아이디어 스케치', en: 'Idea sketch' },
    desc: { ko: '한 줄 요약 · 왜 · 어떻게 · 다음', en: 'One line · why · how · next' },
    html: {
      ko: `<p><span class="fs-l"><b>한 줄로 말하면</b></span></p><p><mark class="hl-yellow">아이디어를 한 문장으로</mark></p><h3>${ico('circle-help')} 왜 좋은가</h3><ul><li></li></ul><h3>${ico('wrench')} 어떻게 만들까</h3><ul><li></li></ul><h3>${ico('rocket')} 다음 한 걸음</h3><p></p>`,
      en: `<p><span class="fs-l"><b>In one line</b></span></p><p><mark class="hl-yellow">The idea in a sentence</mark></p><h3>${ico('circle-help')} Why it matters</h3><ul><li></li></ul><h3>${ico('wrench')} How it could work</h3><ul><li></li></ul><h3>${ico('rocket')} Next step</h3><p></p>`
    }
  },
  {
    id: 'artwork', icon: 'palette',
    name: { ko: '작업 기록', en: 'Work log' },
    desc: { ko: '레퍼런스 · 팔레트 · 진행 · 배운 점', en: 'References · palette · progress · lessons' },
    html: {
      ko: `<h2>작업 이름</h2><p><b>도구</b> <span class="c-gray">사용한 프로그램, 브러시</span></p><h3>${ico('bookmark')} 레퍼런스</h3><ul><li></li></ul><h3>${ico('palette')} 팔레트</h3><p><span class="c-red">●</span> <span class="c-orange">●</span> <span class="c-amber">●</span> <span class="c-teal">●</span> <span class="c-blue">●</span> <span class="c-violet">●</span> <span class="c-gray">색 이름이나 코드</span></p><h3>${ico('chart-line')} 진행</h3><p><mark class="bg-blue">스케치</mark> → 채색 → 마무리</p><h3>${ico('sparkles')} 배운 점</h3><blockquote></blockquote>`,
      en: `<h2>Piece title</h2><p><b>Tools</b> <span class="c-gray">app, brushes</span></p><h3>${ico('bookmark')} References</h3><ul><li></li></ul><h3>${ico('palette')} Palette</h3><p><span class="c-red">●</span> <span class="c-orange">●</span> <span class="c-amber">●</span> <span class="c-teal">●</span> <span class="c-blue">●</span> <span class="c-violet">●</span> <span class="c-gray">names or hex codes</span></p><h3>${ico('chart-line')} Progress</h3><p><mark class="bg-blue">Sketch</mark> → colour → finish</p><h3>${ico('sparkles')} What I learned</h3><blockquote></blockquote>`
    }
  },
  {
    id: 'book', icon: 'book-open',
    name: { ko: '독서 노트', en: 'Reading notes' },
    desc: { ko: '책 정보 · 문장 · 내 생각', en: 'Book · quotes · my take' },
    html: {
      ko: `<h2>책 제목</h2><p><b>저자</b> <span class="c-gray">이름</span> · <b>별점</b> <span class="c-amber">★★★★☆</span></p><h3>${ico('bookmark')} 마음에 남은 문장</h3><blockquote>“ ”</blockquote><h3>${ico('message-circle')} 내 생각</h3><p></p><h3>${ico('check')} 해볼 것</h3><ul><li></li></ul>`,
      en: `<h2>Book title</h2><p><b>Author</b> <span class="c-gray">name</span> · <b>Rating</b> <span class="c-amber">★★★★☆</span></p><h3>${ico('bookmark')} Lines that stayed</h3><blockquote>“ ”</blockquote><h3>${ico('message-circle')} My take</h3><p></p><h3>${ico('check')} To try</h3><ul><li></li></ul>`
    }
  },
  {
    id: 'trip', icon: 'plane',
    name: { ko: '여행 계획', en: 'Trip plan' },
    desc: { ko: '일정 · 가볼 곳 · 준비물 · 예산', en: 'Dates · places · packing · budget' },
    html: {
      ko: `<h2>여행지</h2><p><b>언제</b> <span class="c-gray">출발 – 도착</span> · <b>누구와</b> <span class="c-gray">이름</span></p><h3>${ico('map-pin')} 가볼 곳</h3><ol><li></li><li></li></ol><h3>${ico('package')} 준비물</h3><ul><li>여권 · 충전기 · 상비약</li></ul><h3>${ico('wallet')} 예산</h3><p><mark class="hl-green">숙소</mark> · <mark class="hl-blue">교통</mark> · <mark class="hl-orange">식비</mark></p>`,
      en: `<h2>Destination</h2><p><b>When</b> <span class="c-gray">depart – return</span> · <b>With</b> <span class="c-gray">names</span></p><h3>${ico('map-pin')} Places</h3><ol><li></li><li></li></ol><h3>${ico('package')} Packing</h3><ul><li>Passport · charger · medicine</li></ul><h3>${ico('wallet')} Budget</h3><p><mark class="hl-green">Stay</mark> · <mark class="hl-blue">Transport</mark> · <mark class="hl-orange">Food</mark></p>`
    }
  },
  {
    id: 'weekly', icon: 'calendar-days',
    name: { ko: '주간 회고', en: 'Weekly review' },
    desc: { ko: '잘한 것 · 아쉬운 것 · 다음 주', en: 'Wins · lessons · next week' },
    html: {
      ko: `<h2>이번 주 돌아보기</h2><h3><span class="c-green">${ico('thumbs-up')} 잘한 것</span></h3><ul><li></li></ul><h3><span class="c-orange">${ico('circle-alert')} 아쉬운 것</span></h3><ul><li></li></ul><h3><span class="c-blue">${ico('target')} 다음 주 목표</span></h3><ol><li></li></ol><p><span class="c-gray">이번 주 점수</span> <b>/ 10</b></p>`,
      en: `<h2>This week</h2><h3><span class="c-green">${ico('thumbs-up')} Went well</span></h3><ul><li></li></ul><h3><span class="c-orange">${ico('circle-alert')} Could be better</span></h3><ul><li></li></ul><h3><span class="c-blue">${ico('target')} Next week</span></h3><ol><li></li></ol><p><span class="c-gray">Score</span> <b>/ 10</b></p>`
    }
  },
  {
    id: 'recipe', icon: 'utensils',
    name: { ko: '레시피', en: 'Recipe' },
    desc: { ko: '재료 · 순서 · 팁', en: 'Ingredients · steps · tips' },
    html: {
      ko: `<h2>요리 이름</h2><p><b>분량</b> <span class="c-gray">2인분</span> · <b>시간</b> <span class="c-gray">30분</span></p><h3>${ico('shopping-cart')} 재료</h3><ul><li></li><li></li></ul><h3>${ico('list-ordered')} 순서</h3><ol><li></li><li></li></ol><blockquote>${ico('lightbulb')} 팁</blockquote>`,
      en: `<h2>Dish name</h2><p><b>Serves</b> <span class="c-gray">2</span> · <b>Time</b> <span class="c-gray">30 min</span></p><h3>${ico('shopping-cart')} Ingredients</h3><ul><li></li><li></li></ul><h3>${ico('list-ordered')} Steps</h3><ol><li></li><li></li></ol><blockquote>${ico('lightbulb')} Tip</blockquote>`
    }
  },
  {
    id: 'shopping', icon: 'shopping-cart',
    name: { ko: '장보기 목록', en: 'Shopping list' },
    desc: { ko: '구역별로 나눈 목록', en: 'Grouped by aisle' },
    html: {
      ko: `<h3><span class="c-green">채소 · 과일</span></h3><ul><li></li></ul><h3><span class="c-red">고기 · 생선</span></h3><ul><li></li></ul><h3><span class="c-blue">유제품 · 음료</span></h3><ul><li></li></ul><h3><span class="c-gray">생활용품</span></h3><ul><li></li></ul>`,
      en: `<h3><span class="c-green">Produce</span></h3><ul><li></li></ul><h3><span class="c-red">Meat · fish</span></h3><ul><li></li></ul><h3><span class="c-blue">Dairy · drinks</span></h3><ul><li></li></ul><h3><span class="c-gray">Household</span></h3><ul><li></li></ul>`
    }
  }
];
const templateHTML = (tpl, lang) => (tpl.html[lang] || tpl.html.en).replace(/<li><\/li>/g, '<li><br></li>').replace(/<p><\/p>/g, '<p><br></p>').replace(/<blockquote><\/blockquote>/g, '<blockquote><br></blockquote>');

export { TEMPLATES, templateHTML };
