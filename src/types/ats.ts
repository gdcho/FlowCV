export interface ATSCategoryScore {
  score: number;
  max: number;
  note: string;
}

export interface ATSScoreResult {
  overall: number;
  breakdown: {
    keywords: ATSCategoryScore;   // max 40
    formatting: ATSCategoryScore; // max 25
    experience: ATSCategoryScore; // max 20
    education: ATSCategoryScore;  // max 10
    location: ATSCategoryScore;   // max 5
  };
  missingKeywords: string[];
  matchedKeywords: string[];
  improvements: string[];
}
