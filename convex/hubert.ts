import { v } from "convex/values";
import { internalAction } from "./_generated/server";


export async function getHubertOpenSummaryUrl(teamtailorId: string) {
    const partnerResultsUrl = `${process.env.TEAMTAILOR_BASE_URL}/candidates/${teamtailorId}/partner-results`;
    const response = await fetch(partnerResultsUrl, {
        method: "GET",
        headers: {
            Authorization: `Token token=${process.env.TEAMTAILOR_API_KEY}`,
            "X-Api-Version": "20210218",
            "Content-Type": "application/json",
        },
    });
    if (!response.ok) {
        throw new Error(`Teamtailor API error: ${response.status} ${response.statusText}`);
    }
    const responseJson = await response.json();
    if (!responseJson.data) {
        throw new Error("No partner results found");
    }
    for (const partnerResult of responseJson.data) {
        if(partnerResult.attributes["partner-name"].toLowerCase() === "hubert.ai") {
            for (const attachment of partnerResult.attributes.attachments) {
                if(attachment.description === "Open Application Summary" && attachment.url) {
                    return attachment.url;
                }
            }
        }
    }
    return
}




async function fetchHubertOpenApplication(
    endpoint: string,
    applicationId: string,
    referer?: string
): Promise<any> {
    const query = `query pub_OpenApplication($applicationId: String!) {\n  OpenApplication(applicationId: $applicationId) {\n    id\n    score\n    status\n    score\n    stage\n    createdAt\n    accepted\n    activityLog {\n      createdAt\n      status\n      stage\n      actionType\n      message\n      __typename\n    }\n    candidate {\n      id\n      firstName\n      lastName\n      email\n      phoneNumber\n      __typename\n    }\n    job {\n      id\n      company\n      title\n      threshold\n      location {\n        name\n        __typename\n      }\n      position\n      __typename\n    }\n    _summaries {\n      id\n      threshold\n      aiDetection {\n        isAi\n        score\n        tag\n        __typename\n      }\n      summaryPart: summary {\n        header\n        icon\n        bonuspoints\n        average\n        points\n        maxPoints\n        threshold\n        details {\n          label\n          question\n          icon\n          answer\n          points\n          bonuspoints\n          isCorrect\n          qualified\n          options {\n            label\n            points\n            isCorrect\n            answered\n            evaluation {\n              name\n              value\n              bonus_points\n              __typename\n            }\n            __typename\n          }\n          aiDetection {\n            isAi\n            score\n            tag\n            __typename\n          }\n          reset\n          __typename\n        }\n        __typename\n      }\n      __typename\n    }\n    __typename\n  }\n}`;
    const res: Response = await fetch(endpoint, {
        method: "POST",
        headers: {
            "content-type": "application/json",
            ...(referer ? { Referer: referer, Origin: new URL(referer).origin } : {}),
        },
        body: JSON.stringify({ operationName: "pub_OpenApplication", variables: { applicationId }, query }),
    });
    if (!res.ok) {
        throw new Error(`Hubert GQL error: ${res.status} ${res.statusText}`);
    }
    const json: any = await res.json();
    return json;
}

function mapHubertAnswersFromOpenApplication(openAppJson: any): string {
    const summaries: Array<any> = openAppJson?.data?.OpenApplication?._summaries ?? [];
    const qaPairs: string[] = [];
    
    for (const s of summaries) {
        const summaryPart = s?.summaryPart;
        const parts: Array<any> = Array.isArray(summaryPart) ? summaryPart : (summaryPart ? [summaryPart] : []);
        for (const part of parts) {
            const details: Array<any> = part?.details ?? [];
            for (const d of details) {
                const question = d?.question ?? "";
                const answer = typeof d?.answer === "string" ? d.answer : (d?.answer ?? "");
                
                // Clean HTML tags from question and answer
                const cleanQuestion = question.replace(/<[^>]*>/g, "").trim();
                const cleanAnswer = answer.replace(/<[^>]*>/g, "").trim();
                
                if (cleanAnswer) {
                    qaPairs.push(`Question: ${cleanQuestion}\nAnswer: ${cleanAnswer}`);
                }
            }
        }
    }
    
    return qaPairs.join("\n\n");
}


function extractHubertApplicationId(shareUrl: string): string | null {
    try {
        const url = new URL(shareUrl);
        const parts = url.pathname.split("/").filter(Boolean);
        const id = parts[parts.length - 1];
        return id || null;
    } catch {
        return null;
    }
}


export const fetchHubert = internalAction({
    args: {
        teamtailorId: v.string(),
    },
    handler: async (ctx, args) => {
        const hubertOpenSummaryUrl = await getHubertOpenSummaryUrl(args.teamtailorId);
        if(!hubertOpenSummaryUrl) return { hubertUrl: undefined, hubertAnswers: undefined };
        
        const applicationId = extractHubertApplicationId(hubertOpenSummaryUrl);
        if(!applicationId) return { hubertUrl: hubertOpenSummaryUrl, hubertAnswers: undefined };

        const gqlJson = await fetchHubertOpenApplication("https://app.hubert.ai/graphql", applicationId, hubertOpenSummaryUrl);
        const hubertAnswers = mapHubertAnswersFromOpenApplication(gqlJson);
        return { hubertUrl: hubertOpenSummaryUrl, hubertAnswers };
    }
});