import { createFileRoute, notFound } from "@tanstack/react-router";
import { ArticlePage } from "@/components/meridian/article-page";
import { articleDescription, articleQuestions } from "@/lib/articles/body";
import { pageHead, SITE } from "@/lib/seo";

export const Route = createFileRoute("/learn/$slug")({
  loader: async ({ params }) => {
    const { getArticle } = await import("@/lib/articles/server");
    const article = await getArticle(params.slug);
    if (!article) throw notFound();
    return article;
  },
  head: ({ loaderData }) => {
    if (!loaderData) return { meta: [] };
    const path = `/learn/${loaderData.slug}`;
    const url = `${SITE}${path}`;
    const day = loaderData.createdAt.slice(0, 10);
    const questions = articleQuestions(loaderData.body);
    const faq = questions.length
      ? {
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: questions.map((item) => ({
            "@type": "Question",
            name: item.question,
            acceptedAnswer: { "@type": "Answer", text: item.answer },
          })),
        }
      : null;
    const articleLd = {
      "@context": "https://schema.org",
      "@type": "Article",
      headline: loaderData.pageTitle,
      url,
      mainEntityOfPage: url,
      datePublished: day,
      dateModified: day,
      author: {
        "@type": "Person",
        name: 'Matthew "Cain" Olde',
        url: `${SITE}/about`,
      },
    };
    const crumbs = {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: `${SITE}/` },
        { "@type": "ListItem", position: 2, name: "Learn", item: `${SITE}/learn` },
        { "@type": "ListItem", position: 3, name: loaderData.h1, item: url },
      ],
    };
    return pageHead({
      title: loaderData.pageTitle,
      description: articleDescription(loaderData.body),
      path,
      jsonLd: [articleLd, faq, crumbs].filter(
        (block): block is Record<string, unknown> => block != null,
      ),
    });
  },
  component: LearnArticle,
});

function LearnArticle() {
  return <ArticlePage article={Route.useLoaderData()} />;
}
