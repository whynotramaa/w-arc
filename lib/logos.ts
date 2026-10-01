import {
  siAirbnb, siAnthropic, siAngular, siApachekafka, siApple, siBun, siClaude, siCloudflare, siDeno, siDigitalocean,
  siDiscord, siDjango, siDocker, siElasticsearch, siExpress, siFastapi, siFigma, siFirebase, siGit, siGithub,
  siGithubactions, siGitlab, siGo, siGoogle, siGooglecloud, siGooglegemini, siGrafana, siGraphql, siHuggingface,
  siJavascript, siKotlin, siKubernetes, siLangchain, siLinux, siMeta, siMetaai, siMistralai, siMongodb, siMysql,
  siNetflix, siNetlify, siNextdotjs, siNginx, siNodedotjs, siNotion, siOllama, siOpenjdk, siPerplexity,
  siPostgresql, siPrisma, siPrometheus, siPython, siPytorch, siRabbitmq, siReact, siRedis, siRust, siSpotify,
  siSqlite, siStripe, siSupabase, siSvelte, siSwift, siTailwindcss, siTensorflow, siTerraform, siTypescript,
  siUber, siVercel, siVite, siVuedotjs, siX, siYoutube,
} from 'simple-icons'

type Icon = { slug: string; title: string; hex: string; path: string }
export type Logo = { id: string; label: string; group: string; hex: string; path: string }

const GROUPS: [string, Icon[]][] = [
  ['Frontend', [siReact, siNextdotjs, siVuedotjs, siSvelte, siAngular, siTailwindcss, siVite, siFigma]],
  ['Languages', [siTypescript, siJavascript, siPython, siGo, siRust, siOpenjdk, siKotlin, siSwift, siNodedotjs, siDeno, siBun]],
  ['Backend', [siFastapi, siDjango, siExpress, siGraphql, siNginx, siApachekafka, siRabbitmq, siStripe]],
  ['Databases', [siPostgresql, siMysql, siMongodb, siRedis, siSqlite, siSupabase, siFirebase, siPrisma, siElasticsearch]],
  ['Cloud & DevOps', [siDocker, siKubernetes, siTerraform, siLinux, siGit, siGithub, siGitlab, siGithubactions, siVercel, siNetlify, siCloudflare, siGooglecloud, siDigitalocean, siGrafana, siPrometheus]],
  ['AI', [siAnthropic, siClaude, siGooglegemini, siMistralai, siMetaai, siPerplexity, siHuggingface, siPytorch, siTensorflow, siLangchain, siOllama]],
  ['Companies', [siGoogle, siApple, siMeta, siX, siYoutube, siSpotify, siNetflix, siUber, siAirbnb, siDiscord, siNotion]],
]

export const LOGOS: Logo[] = GROUPS.flatMap(([group, icons]) =>
  icons.map(i => ({ id: 'logo:' + i.slug, label: i.title, group, hex: '#' + i.hex, path: i.path })),
)

export const LOGO_MAP = Object.fromEntries(LOGOS.map(l => [l.id, l]))

const paths = new Map<string, Path2D>()
export const logoPath = (l: Logo) => {
  if (!paths.has(l.id)) paths.set(l.id, new Path2D(l.path))
  return paths.get(l.id)!
}

export const isDark = (hex: string) => {
  const n = parseInt(hex.slice(1), 16)
  return 0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255) < 40
}
