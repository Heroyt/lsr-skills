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

for (const markdownPath of markdownFiles) {
  const content = await readFile(markdownPath, 'utf8')
  const relativePath = markdownPath.slice(root.length + 1)
  const fenceCount = content.split(/\r?\n/).filter((line) => line.startsWith('```')).length
  if (fenceCount % 2 !== 0) {
    errors.push(`${relativePath}: unbalanced fenced code blocks`)
  }

  for (const match of content.matchAll(/\]\(([^)]+)\)/g)) {
    const target = match[1].split('#', 1)[0]
    if (!target || /^(?:https?:|mailto:)/.test(target)) {
      continue
    }
    const resolvedTarget = resolve(dirname(markdownPath), decodeURIComponent(target))
    if (!(await exists(resolvedTarget))) {
      errors.push(`${relativePath}: broken local link ${match[1]}`)
    }
  }
}

if (errors.length > 0) {
  console.error(errors.map((error) => `- ${error}`).join('\n'))
  process.exitCode = 1
} else {
  console.log(`Validated ${skills.size} skills, catalog entries, references, links, and Markdown fences.`)
}
