

const getResearchLetterType = (row = {}) =>
  row.letter_kind === INTERVIEW_LETTER_KIND
    ? INTERVIEW_LETTER_KIND
    : row.letter_kind === PERMISSION_LETTER_KIND
      ? PERMISSION_LETTER_KIND
      : RESEARCH_LETTER_KIND;