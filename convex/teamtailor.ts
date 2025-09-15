import {
    action,
    internalAction,
    query
} from "./_generated/server";
import { v } from "convex/values";

const baseApiUrl = process.env.TEAMTAILOR_BASE_URL || "https://api.teamtailor.com/v1";
const xameraTeamtailorId = "Epgs55TVBkQ"
const baseWebUrl = process.env.TEAMTAILOR_BASE_WEB_URL || "https://app.teamtailor.com/companies/" + xameraTeamtailorId;

async function fetchAllPagesFromTeamtailor(url: string) {
    const apiKey = process.env.TEAMTAILOR_API_KEY;
    
    if (!apiKey) {
        throw new Error("TEAMTAILOR_API_KEY environment variable is required");
    }
    let nextPage = url;
    const data : any[] = [];

    while (nextPage) {
        const response = await fetch(nextPage, {
            method: 'GET',
            headers: {
                'Authorization': `Token token=${apiKey}`,
                'X-Api-Version': '20210218',
                'Content-Type': 'application/json',
            },
        });
        const responseJson = await response.json();
        nextPage = responseJson.links.next;
        data.push(...responseJson.data);
    }
    return data;
}

async function fetchPageFromTeamtailor(url: string, page: number = 1, perPage: number = 25, sort: string = "-updated-at", filter: string = "") {
    const apiKey = process.env.TEAMTAILOR_API_KEY;
    
    if (!apiKey) {
        throw new Error("TEAMTAILOR_API_KEY environment variable is required");
    }

    // Add pagination parameters to the URL
    const paginatedUrl = `${url}?page[size]=${perPage}&page[number]=${page}&sort=${sort}&${filter}`;

    const response = await fetch(paginatedUrl, {
        method: 'GET',
        headers: {
            'Authorization': `Token token=${apiKey}`,
            'X-Api-Version': '20210218',
            'Content-Type': 'application/json',
        },
    });

    if (!response.ok) {
        console.log(response);
        throw new Error(`TeamTailor API error: ${response.status} ${response.statusText}`);
    }

    const responseJson = await response.json();
    
    return {
        data: responseJson.data,
        meta: responseJson.meta,
        links: responseJson.links
    };
}

// Keep the original function for backward compatibility
export const importCandidate = internalAction({
    args: {
        teamtailorId: v.string(),
    },
    handler: async (ctx, args) => {
        try {
   
            const apiKey = process.env.TEAMTAILOR_API_KEY;
            
            if (!apiKey) {
                throw new Error("TEAMTAILOR_API_KEY environment variable is required");
            }

            // Fetch candidate from Teamtailor API
            const response = await fetch(`${baseApiUrl}/candidates/${args.teamtailorId}`, {
                method: 'GET',
                headers: {
                    'Authorization': `Token token=${apiKey}`,
                    'X-Api-Version': '20210218',
                    'Content-Type': 'application/json',
                },
            });

            if (!response.ok) {
                throw new Error(`Teamtailor API error: ${response.status} ${response.statusText}`);
            }

            const candidate = await response.json();

            const hasFirstName = candidate.data.attributes["first-name"] !== null;
            const hasLastName = candidate.data.attributes["last-name"] !== null;
            
            const name = hasFirstName && hasLastName ? candidate.data.attributes["first-name"] + " " + candidate.data.attributes["last-name"] : candidate.data.attributes.email;
            return  {
                name,
                imageUrl: candidate.data.attributes.picture ?? candidate.data.attributes.avatar ?? candidate.data.attributes.image,
                email: candidate.data.attributes.email,
                linkedinUrl: candidate.data.attributes["linkedin-url"] === null ? undefined : candidate.data.attributes["linkedin-url"], 
                resumeSummary: candidate.data.attributes["resume-summary"] === null ? undefined : candidate.data.attributes["resume-summary"],
                linkedinSummary: candidate.data.attributes["linkedin-profile"] === null ? undefined : candidate.data.attributes["linkedin-profile"],
                rawData: candidate,
                updatedAtTT: Date.parse(candidate.data.attributes["updated-at"]),
                createdAtTT: Date.parse(candidate.data.attributes["created-at"]),
            };
            
        } catch (error) {
            throw new Error(error instanceof Error ? error.message : "Unknown error occurred");
        }
    },
});


export const fetchCandidateAssesment = internalAction({
    args: {
        teamtailorId: v.string(),
    },
    handler: async (ctx, args) => {

        const apiKey = process.env.TEAMTAILOR_API_KEY;
        
        if (!apiKey) {
            throw new Error("TEAMTAILOR_API_KEY environment variable is required");
        }
        const assesmentUrl = `${baseApiUrl}/candidates/${args.teamtailorId}/activities?filter[code]=application_review`;
   
        const assesment = await fetch(assesmentUrl,  {
            method: "GET",
            headers: {
                Authorization: `Token token=${apiKey}`,
                "X-Api-Version": "20210218",
                "Content-Type": "application/json",
            },
        });
        const assesmentJson = await assesment.json();
        
        if (!assesmentJson.data || assesmentJson.data.length === 0) return {};
        
        const assesmentData = JSON.parse(assesmentJson.data[0].attributes.data);
        return {
            comment: assesmentData.comment,
            rating: assesmentData.rating,
            createdAt: assesmentJson.data[0].attributes["created-at"],
        };
    },

});



export const getCandidatesByUpdatedTT = internalAction({
    args: {
        updatedAtTT: v.number(),
    },
    handler: async (ctx, args) => {
        try {
       
            const teamtailorIds : string[] = [];
            const data = await fetchAllPagesFromTeamtailor(`${baseApiUrl}/candidates?filter[updated-at][from]=${new Date(args.updatedAtTT).toISOString()}`);
            
            for (const candidate of data) {
                teamtailorIds.push(candidate.id);
            }
            return teamtailorIds;
            
        } catch (error) {
            throw new Error(error instanceof Error ? error.message : "Unknown error occurred");
        }
        
    },
});

export const importJob = internalAction({
    args: {
        teamtailorId: v.string(),
    },
    handler: async (ctx, args) => {

        try {

        const apiKey = process.env.TEAMTAILOR_API_KEY;
        
        if (!apiKey) {
            throw new Error("TEAMTAILOR_API_KEY environment variable is required");
        }

        const job = await fetch(`${baseApiUrl}/jobs/${args.teamtailorId}`, {
            method: "GET",
            headers: {
                Authorization: `Token token=${apiKey}`,
                "X-Api-Version": "20210218",
                "Content-Type": "application/json",
            },
        });
        const jobJson = await job.json();

        return {
            title: jobJson.data.attributes.title,
            status: jobJson.data.attributes.status,
            department: jobJson.data.attributes.department,
            location: jobJson.data.attributes.location,
            updatedAtTT: Date.parse(jobJson.data.attributes["updated-at"]),
            createdAtTT: Date.parse(jobJson.data.attributes["created-at"]),
            rawData: jobJson.data,
            };

        } catch (error) {
            throw new Error(error instanceof Error ? error.message : "Unknown error occurred");
        }
    },
});





//Api

export const listCandidatesFromTeamtailor = action({
    args: {
        page: v.optional(v.number()),
        perPage: v.optional(v.number()),
        sort: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const page = args.page || 1;
        const perPage = args.perPage || 25;
        const sort = args.sort || "-updated-at";
        
        const response = await fetchPageFromTeamtailor(`${baseApiUrl}/candidates`, page, perPage, sort);
        
        const candidates = response.data.map((candidate: any) => {
            return {
                id: candidate.id,
                name: candidate.attributes["first-name"] + " " + candidate.attributes["last-name"],
                email: candidate.attributes.email,
                updatedAtTT: Date.parse(candidate.attributes["updated-at"]),
                createdAtTT: Date.parse(candidate.attributes["created-at"]),
                link: baseWebUrl + "/candidates/" + candidate.id,
            };
        });

        return {
            candidates,
            pagination: {
                currentPage: page,
                perPage: perPage,
                totalPages: response.meta?.["page-count"] || 1,
                totalCount: response.meta?.["record-count"] || candidates.length,
                hasNext: !!response.links?.next,
                hasPrev: !!response.links?.prev,
            }
        };
    },
});

export const listJobsFromTeamtailor = action({
    args: {
        page: v.optional(v.number()),
        perPage: v.optional(v.number()),
        sort: v.optional(v.string()),
        filter: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const page = args.page || 1;
        const perPage = args.perPage || 25;
        const sort = args.sort || "-updated-at";
        const filter = args.filter || "filter[status]=all";
        
        const response = await fetchPageFromTeamtailor(`${baseApiUrl}/jobs`, page, perPage, sort, filter);
        console.log("RESPONSE:", response);
        const jobs = response.data.map((job: any) => {
            return {
                id: job.id,
                title: job.attributes.title,
                internalName: job.attributes["internal-name"],
                status: job.attributes.status,
                department: job.attributes.department,
                location: job.attributes.location,
                updatedAtTT: Date.parse(job.attributes["updated-at"]),
                createdAtTT: Date.parse(job.attributes["created-at"]),
                link: baseWebUrl + "/jobs/" + job.id,
            };
        });

        return {
            jobs,
            pagination: {
                currentPage: page,
                perPage: perPage,
                totalPages: response.meta?.["page-count"] || 1,
                totalCount: response.meta?.["record-count"] || jobs.length,
                hasNext: !!response.links?.next,
                hasPrev: !!response.links?.prev,
            }
        };
    },
});