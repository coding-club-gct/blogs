import { defineDocumentType, makeSource } from 'contentlayer/source-files'
import GithubSlugger from "github-slugger"
import rehypeSlug from "rehype-slug"
import { getTimeString } from './src/lib/getTimeString'
import { Issue } from './src/types/issues'

async function getProfileFromUsername(username: string) {
    const profile = await fetch(`https://api.github.com/users/${username}`, {
        method: "GET",
        headers: {
            "Authorization": `token ${process.env.NEXT_PUBLIC_GITHUB_PAT!}`,
            "Content-Type": "application/json"
        },
        cache: "force-cache"
    }).then(res => res.json())
    return profile
}

async function getIssueNumber(title: string) {
    const issues: Issue[] = await fetch("https://api.github.com/repos/coding-club-gct/blogs/issues", {
        headers: {
            "Accept": "application/vnd.github+json",
            "Authorization": `Bearer ${process.env.NEXT_PUBLIC_GITHUB_PAT}`,
        },
    }).then(res => res.json());
    const found = issues.find(issue => issue.title === title)
    if (!found) {
        const { id } = await fetch("https://api.github.com/user", {
            method: "GET",
            headers: {
                "Authorization": `token ${process.env.NEXT_PUBLIC_GITHUB_PAT!}`,
                "Content-Type": "application/json"
            }
        }).then(res => res.json())
        if (id === 80976002) {
            const resp: Issue = await fetch("https://api.github.com/repos/coding-club-gct/blogs/issues", {
                method: "POST",
                headers: {
                    "Accept": "application/vnd.github+json",
                    "Authorization": `Bearer ${process.env.NEXT_PUBLIC_GITHUB_PAT}`
                }, body: JSON.stringify({
                    title,
                    body: "Using this space as comment section for the blog post of above pathname",
                })
            }).then(res => res.json())
            return resp.number
        }
        return 20
    }
    return found.number
}

export type GithubDataForBlog = {
    author: {
        name: string,
        blog: string,
        html_url: string,
        email: string,
        avatar_url: string
    }, committer: {
        name: string,
        avatar_url: string
        committed_date: string
    }
}

async function getGithubDataforBlog(pathname: string): Promise<GithubDataForBlog | undefined> {
    const filePathName = `src/blogs/${pathname}.mdx`
    const apiUrl = `https://api.github.com/repos/coding-club-gct/blogs/commits?path=${filePathName}`
    const resp = await fetch(apiUrl, {
        method: "GET",
        headers: {
            "Authorization": `token ${process.env.NEXT_PUBLIC_GITHUB_PAT!}`,
            "X-GitHub-Api-Version": "2022-11-28"
        },
        cache: "force-cache"
    }).then(res => res.json())
    if (!resp.length) {
        console.log(resp)
        return undefined
    }
    const { author } = resp[0]
    const { committer } = resp[resp.length - 1]
    const { name, blog, html_url, email } = await getProfileFromUsername(author.login)
    const { name: committerName } = await getProfileFromUsername(committer.login)
    return {
        author: { name, blog, html_url, email, avatar_url: author.avatar_url },
        committer: { name: committerName, avatar_url: committer.avatar_url, committed_date: getTimeString(resp[resp.length - 1].commit.committer.date) }
    }
}

export const Blog = defineDocumentType(() => ({
    name: "Blog",
    contentType: "mdx",
    filePathPattern: "**/*.mdx",
    fields: {
        tags: {
            type: "list",
            of: {
                type: "string"
            },
        }, title: {
            type: "string",
            required: true
        }, coverImage: {
            type: "string",
            required: true
        }, hideAuthor: {
            type: "boolean"
        }, read: {
            type: "string",
            required: true
        }
    },
    computedFields: {
        url: {
            type: 'string', resolve: (doc) => doc._raw.sourceFilePath.replace(/\.mdx$/, ""),
        },
        headings: {
            type: "json",
            resolve: async (doc) => {
                const regXHeader = /\n(?<flag>#{1,6})\s+(?<content>.+)/g;
                const slugger = new GithubSlugger()
                const headings = Array.from(doc.body.raw.matchAll(regXHeader)).map(
                    ({ groups }) => {
                        const content = groups?.content;
                        return {
                            text: content,
                            slug: content ? slugger.slug(content) : undefined
                        };
                    }
                );
                return headings;
            },
        },
        githubData: {
            type: "json",
            resolve: async (doc) => {
                const pathname = doc._raw.sourceFilePath.replace(/\.mdx$/, "")
                return await getGithubDataforBlog(pathname)
            }
        },
        issueNumber: {
            type: "number",
            resolve: async (doc) => {
                const pathname = doc._raw.sourceFilePath.replace(/\.mdx$/, "")
                return await getIssueNumber(pathname)
            }
        }
    }
}))

export default makeSource({
    contentDirPath: 'src/blogs', documentTypes: [Blog], mdx: {
        rehypePlugins: [rehypeSlug],
    },
})