import { access, readFile, readdir } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const skillsRoot = resolve(root, 'skills')
const errors = []

const exists = async (path) => {
  try {
    await access(path)
    return true
  } catch {
    return false
  }
}

const skillDirectories = (await readdir(skillsRoot, { withFileTypes: true }))
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort()

const skills = new Map()
const markdownFiles = [resolve(root, 'README.md'), resolve(root, 'CONTEXT.md')]

for (const directory of skillDirectories) {
  const skillPath = resolve(skillsRoot, directory, 'SKILL.md')
  if (!(await exists(skillPath))) {
    errors.push(`skills/${directory}: missing SKILL.md`)
    continue
  }

  const content = await readFile(skillPath, 'utf8')
  const lines = content.split(/\r?\n/)
  markdownFiles.push(skillPath)

  if (lines[0] !== '---') {
    errors.push(`skills/${directory}/SKILL.md: missing opening frontmatter delimiter`)
    continue
  }

  const closingDelimiter = lines.indexOf('---', 1)
  if (closingDelimiter === -1) {
    errors.push(`skills/${directory}/SKILL.md: missing closing frontmatter delimiter`)
    continue
  }

  const metadata = new Map()
  for (const line of lines.slice(1, closingDelimiter)) {
    const match = line.match(/^([a-z][a-z0-9_-]*):\s+(.+)$/)
    if (!match) {
      errors.push(`skills/${directory}/SKILL.md: unsupported frontmatter line: ${line}`)
      continue
    }
    if (metadata.has(match[1])) {
      errors.push(`skills/${directory}/SKILL.md: duplicate ${match[1]} metadata`)
    }
    metadata.set(match[1], match[2].trim())
  }

  const name = metadata.get('name')
  const description = metadata.get('description')

  if (name !== directory) {
    errors.push(`skills/${directory}/SKILL.md: name must equal directory name`)
  }
  if (!description || description.length < 20) {
    errors.push(`skills/${directory}/SKILL.md: description must be at least 20 characters`)
  }
  if (skills.has(name)) {
    errors.push(`skills/${directory}/SKILL.md: duplicate skill name ${name}`)
  } else if (name) {
    skills.set(name, { content, path: skillPath })
  }
}

for (const [name, skill] of skills) {
  for (const match of skill.content.matchAll(/`(lsr-[a-z0-9-]+)`/g)) {
    if (!skills.has(match[1])) {
      errors.push(`skills/${name}/SKILL.md: unknown skill reference ${match[1]}`)
    }
  }
}

const readme = await readFile(resolve(root, 'README.md'), 'utf8')
const catalogNames = new Set(
  [...readme.matchAll(/\(skills\/(lsr-[a-z0-9-]+)\/SKILL\.md\)/g)].map((match) => match[1]),
)

for (const name of skills.keys()) {
  if (!catalogNames.has(name)) {
    errors.push(`README.md: missing catalog link for ${name}`)
  }
}
for (const name of catalogNames) {
  if (!skills.has(name)) {
    errors.push(`README.md: stale catalog link for ${name}`)
  }
}

const contentOutsideFences = (content, relativePath) => {
  const proseLines = []
  let fenceCharacter = null
  let fenceLength = 0

  for (const line of content.split(/\r?\n/)) {
    const fenceMatch = line.match(/^\s*(`{3,}|~{3,})/)
    if (fenceMatch) {
      const marker = fenceMatch[1]
      if (fenceCharacter === null) {
        fenceCharacter = marker[0]
        fenceLength = marker.length
        continue
      }
      if (marker[0] === fenceCharacter && marker.length >= fenceLength) {
        fenceCharacter = null
        fenceLength = 0
        continue
      }
    }
    if (fenceCharacter === null) {
      proseLines.push(line)
    }
  }

  if (fenceCharacter !== null) {
    errors.push(`${relativePath}: unbalanced fenced code blocks`)
  }

  return proseLines.join('\n')
}

const markdownLinkPattern =
  /\]\(\s*(?:<([^>\n]+)>|([^\s)]+))(?:\s+(?:"[^"\n]*"|'[^'\n]*'|\([^)\n]*\)))?\s*\)/g

for (const markdownPath of markdownFiles) {
  const content = await readFile(markdownPath, 'utf8')
  const relativePath = markdownPath.slice(root.length + 1)
  const prose = contentOutsideFences(content, relativePath)

  for (const match of prose.matchAll(markdownLinkPattern)) {
    const rawTarget = match[1] ?? match[2]
    const target = rawTarget.split(/[?#]/, 1)[0]
    if (!target || target.startsWith('/') || /^[a-z][a-z0-9+.-]*:/i.test(target)) {
      continue
    }

    let decodedTarget
    try {
      decodedTarget = decodeURIComponent(target)
    } catch {
      errors.push(`${relativePath}: invalid encoded link ${rawTarget}`)
      continue
    }

    const resolvedTarget = resolve(dirname(markdownPath), decodedTarget)
    if (!(await exists(resolvedTarget))) {
      errors.push(`${relativePath}: broken local link ${rawTarget}`)
    }
  }
}

if (errors.length > 0) {
  console.error(errors.map((error) => `- ${error}`).join('\n'))
  process.exitCode = 1
} else {
  console.log(`Validated ${skills.size} skills, catalog entries, references, links, and Markdown fences.`)
}
