export const addKeywordsInEntity = async (entity: string, keyword: string) => {
  const WIT_TOKEN = process.env.WIT_SERVER_TOKEN;
  try {
    await fetch(`https://api.wit.ai/entities/${entity}/keywords`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${WIT_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        keyword: keyword,
        synonyms: [keyword, keyword.toLocaleLowerCase()],
      }),
    });
  } catch (error) {}
};

export const deleteKeywordsInEntity = async (
  entity: string,
  keyword: string
) => {
  const WIT_TOKEN = process.env.WIT_SERVER_TOKEN;
  try {
    await fetch(`https://api.wit.ai/entities/${entity}/keywords/${keyword}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${WIT_TOKEN}`,
      },
    });
  } catch (error) {}
};
