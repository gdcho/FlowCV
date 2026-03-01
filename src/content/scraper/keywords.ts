// Tech stack & tools
const TECH_PATTERN =
  /\b(Python|JavaScript|TypeScript|React|Angular|Vue|Next\.?js|Nuxt|Remix|Node\.?js|Express|NestJS|Fastify|Hono|Django|Flask|FastAPI|Spring|Spring Boot|Java|C\+\+|C#|\.NET|Golang|Go|Rust|Ruby|Rails|PHP|Laravel|Swift|SwiftUI|Kotlin|Jetpack Compose|Scala|R|MATLAB|SQL|PostgreSQL|MySQL|SQLite|MariaDB|MongoDB|Redis|DynamoDB|Cassandra|Elasticsearch|OpenSearch|Pinecone|Weaviate|Kafka|RabbitMQ|Celery|AWS|GCP|Azure|S3|EC2|Lambda|CloudFront|BigQuery|Snowflake|dbt|Airflow|Spark|Hadoop|Docker|Kubernetes|Helm|Terraform|Ansible|Jenkins|GitHub Actions|CircleCI|GitLab CI|Datadog|Sentry|New Relic|Prometheus|Grafana|Git|REST|GraphQL|gRPC|WebSockets|Microservices|Agile|Scrum|Kanban|JIRA|Linear|Confluence|Machine Learning|Deep Learning|NLP|LLM|RAG|TensorFlow|PyTorch|scikit-learn|Pandas|NumPy|Tableau|Power BI|Looker|Figma|Storybook|CI\/CD|DevOps|MLOps|Linux|Unix|Bash|Shell|Tailwind|Tailwind CSS|shadcn|Radix|Vite|Webpack|Rollup|esbuild|Prisma|Drizzle|SQLAlchemy|tRPC|Zod|Zustand|Redux|MobX|Jotai|React Query|SWR|Vercel|Netlify|Supabase|Firebase|PlanetScale|Neon|Stripe|Twilio|SendGrid|Auth0|Clerk|Okta|OpenAI|Anthropic|Hugging Face|LangChain|LlamaIndex|Langfuse|Weaviate|Chroma|React Native|Flutter|Expo|Ionic|Capacitor|Electron|Tauri|Jest|Vitest|Cypress|Playwright|pytest|Testing Library|Selenium|k6|Vim)\b/gi

// Soft skills
const SOFT_PATTERN =
  /\b(cross.functional|cross functional|stakeholder|collaboration|communication|leadership|mentoring|mentorship|ownership|ambiguity|problem.solving|analytical|strategic|detail.oriented|self.starter|fast.paced|results.driven|data.driven|critical thinking|presentation skills|written communication|verbal communication|independent|autonomous|proactive|initiative|adaptable|curious|empathetic|inclusive)\b/gi

// Degree requirements
const DEGREE_PATTERN =
  /\b(Bachelor(?:'s)?(?:\s+(?:degree|of\s+Science|of\s+Arts))?|Master(?:'s)?(?:\s+(?:degree|of\s+Science))?|MBA|PhD|Ph\.D|Associate(?:'s)?(?:\s+degree)?|B\.?S\.?|M\.?S\.?|B\.?A\.?|M\.?A\.?|Computer Science|Software Engineering|Electrical Engineering|Information Systems)\b/g

// Certifications
const CERT_PATTERN =
  /\b(AWS Certified|Google Cloud Certified|Azure Certified|PMP|CPA|CFA|CISSP|CEH|CompTIA|Scrum Master|CSM|CISA|CISM|Six Sigma|PMI|CKA|CKAD|Terraform Associate)\b/gi

// Industry / domain areas
const DOMAIN_PATTERN =
  /\b(SaaS|B2B|B2C|fintech|healthtech|edtech|legaltech|proptech|e-commerce|ecommerce|marketplace|enterprise|startup|growth|product-led|platform|API-first|mobile|embedded|real-time|distributed systems|cloud.native|serverless|security|compliance|HIPAA|SOC 2|GDPR|PCI|zero.trust|observability|reliability|SRE|data engineering|data science|data analytics|business intelligence|product analytics|growth hacking|revenue|monetization|payments)\b/gi

export function extractKeywords(text: string): string[] {
  const seen = new Set<string>()
  const result: string[] = []

  function addMatches(pattern: RegExp, normalize = true) {
    for (const match of text.matchAll(pattern)) {
      const key = normalize ? match[0].toLowerCase() : match[0]
      if (!seen.has(key)) {
        seen.add(key)
        result.push(match[0])
      }
    }
  }

  addMatches(TECH_PATTERN)
  addMatches(SOFT_PATTERN)
  addMatches(CERT_PATTERN)
  addMatches(DOMAIN_PATTERN)

  // Degree requirements (deduplicate by normalized form)
  for (const match of text.matchAll(DEGREE_PATTERN)) {
    const key = match[0].replace(/['.]/g, '').toLowerCase()
    if (!seen.has(key)) {
      seen.add(key)
      result.push(match[0])
    }
  }

  // Years of experience - extract "X+ years of <domain>" if present
  for (const m of text.matchAll(/(\d+)\+?\s*years?\s+(?:of\s+)?(?:experience\s+(?:in|with)\s+([\w\s,/+#.]+?(?:\s|$))|experience)/gi)) {
    const years = m[1]
    const domain = m[2]?.trim().replace(/[,.]$/, '').slice(0, 40)
    const kw = domain ? `${years}+ years ${domain}` : `${years}+ years experience`
    if (!seen.has(kw.toLowerCase())) {
      seen.add(kw.toLowerCase())
      result.push(kw)
    }
  }

  return result.slice(0, 50)
}
