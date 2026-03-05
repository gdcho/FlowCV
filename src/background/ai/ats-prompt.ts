import type { JobContext } from "@/types/job";

export function buildATSSystemPrompt(): string {
  return `You are an ATS (Applicant Tracking System) scoring expert. Score the provided resume against the job description using these weighted criteria:

1. KEYWORD MATCH (40 points max)
Exact-phrase matches of hard skills, tools, technologies, and certifications from the JD. Required skills missing from the resume count heavily against this score. Include both acronym and full-term matches ("CI/CD" and "Continuous Integration"). Soft skills count minimally; technical hard skills dominate.

2. FORMATTING (25 points max)
For LaTeX resumes, check: standard section headers (Work Experience, Education, Skills, Summary), logical section ordering, absence of multi-column layouts or tables that confuse parsers, clean bullet structure. LaTeX single-column is generally ATS-safe.

3. EXPERIENCE FIT (20 points max)
Years of experience vs. requirement, recency of relevant skills (last 2 years weighted most), job title alignment with the target role, contextual evidence (skills demonstrated in measurable bullets vs. only listed in skills section).

4. EDUCATION & CERTIFICATIONS (10 points max)
Required or preferred degrees and certifications present or absent. Matching field of study scores higher.

5. LOCATION (5 points max)
If the role specifies remote, hybrid, or on-site, and the resume includes a location or remote-work history, score compatibility. If no location info is available in either, award 3/5.

SCORING RULES:
- Be realistic and calibrated. A strong match scores 70-80. Near-perfect match scores 85+. Most resumes score 45-70.
- overall MUST equal the exact sum of all five category scores.
- missingKeywords: up to 8 important JD skills/tools not found anywhere in the resume.
- matchedKeywords: up to 10 important JD skills/tools confirmed present in the resume.
- improvements: up to 5 specific, actionable fixes ordered by impact on score.

Return ONLY valid JSON (no markdown fences, no extra text):
{
  "overall": <integer 0-100>,
  "breakdown": {
    "keywords":   { "score": <0-40>, "max": 40, "note": "<1 concise sentence>" },
    "formatting": { "score": <0-25>, "max": 25, "note": "<1 concise sentence>" },
    "experience": { "score": <0-20>, "max": 20, "note": "<1 concise sentence>" },
    "education":  { "score": <0-10>, "max": 10, "note": "<1 concise sentence>" },
    "location":   { "score": <0-5>,  "max": 5,  "note": "<1 concise sentence>" }
  },
  "missingKeywords": ["<keyword>"],
  "matchedKeywords":  ["<keyword>"],
  "improvements": ["<actionable tip>"]
}`;
}

export function buildATSUserPrompt(resumeText: string, jd: JobContext): string {
  const meta = [
    jd.title && `Title: ${jd.title}`,
    jd.company && `Company: ${jd.company}`,
    jd.seniority && `Seniority: ${jd.seniority}`,
  ]
    .filter(Boolean)
    .join("\n");

  const jdBody = jd.fullText.slice(0, 5000);

  return `JOB DESCRIPTION:
${meta}

${jdBody}

---

RESUME (LaTeX source):
${resumeText.slice(0, 8000)}

---

Score this resume against the job description. Return only JSON.`;
}
