import {
    action,
    internalAction,
    internalMutation,
    mutation,
    query
} from "./_generated/server";
import { v } from "convex/values";
import { TeamtailorCandidate, TeamtailorJob } from "./types";
import { paginationOptsValidator } from "convex/server";

const baseApiUrl = process.env.TEAMTAILOR_BASE_URL || "https://api.teamtailor.com/v1";
const xameraTeamtailorId = "Epgs55TVBkQ"
const baseWebUrl = process.env.TEAMTAILOR_BASE_WEB_URL || "https://app.teamtailor.com/companies/" + xameraTeamtailorId;





function parseTeamtailorBody(text: string) {

    function sanitizeKey(key: string): string {
        return key
          .normalize("NFD")              
          .replace(/[\u0300-\u036f]/g, '') 
          .replace(/[^\x20-\x7E]/g, '')   
          .replace(/\s+/g, '_')          
          .toLowerCase();                
      }

    const cleaned = text.replace(/\\n/g, '\n');
    const lines = cleaned.split('\n');
    const result: Record<string, string> = {};
    let currentKey: string | null = null;
  
    for (let line of lines) {
      line = line.trim();
      if (line === '') continue;
  
      if (line.includes(':')) {
        const [key, ...rest] = line.split(':');
        const sanitizedKey = sanitizeKey(key.trim());
        currentKey = sanitizedKey;
        const value = rest.join(':').trim();
        result[sanitizedKey] = value || '';
      } else if (currentKey) {
        result[currentKey] += '\n' + line;
      }
    }
  
    return result;
  }
  
  

  
async function fetchAllPagesFromTeamtailor(url: string, maxRetries: number = 3) {
    const apiKey = process.env.TEAMTAILOR_API_KEY;
    
    if (!apiKey) {
        throw new Error("TEAMTAILOR_API_KEY environment variable is required");
    }
    let nextPage = url;
    const data : any[] = [];

    while (nextPage) {
        let retries = 0;
        let success = false;
        
        while (retries < maxRetries && !success) {
            try {
                const response = await fetch(nextPage, {
                    method: 'GET',
                    headers: {
                        'Authorization': `Token token=${apiKey}`,
                        'X-Api-Version': '20210218',
                        'Content-Type': 'application/json',
                    },
                    // Add timeout to prevent hanging connections
                    signal: AbortSignal.timeout(30000), // 30 second timeout
                });
                
                if (!response.ok) {
                    throw new Error(`Teamtailor API error: ${response.status} ${response.statusText}`);
                }
                
                const responseJson = await response.json();
                nextPage = responseJson.links?.next ? responseJson.links.next : undefined;
                data.push(...responseJson.data);
                success = true;
                
            } catch (error) {
                retries++;
                console.error(`Attempt ${retries} failed for URL ${nextPage}:`, error);
                
                if (retries >= maxRetries) {
                    throw new Error(`Failed to fetch from Teamtailor API after ${maxRetries} attempts: ${error instanceof Error ? error.message : 'Unknown error'}`);
                }
                
                // Exponential backoff: wait 1s, 2s, 4s between retries
                const delay = Math.pow(2, retries - 1) * 1000;
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
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
        // Try to fetch assessment with new namespace first
        let assesmentUrl = `${baseApiUrl}/candidates/${args.teamtailorId}/activities?filter[code]=application_review`;
        
        let assesment = await fetch(assesmentUrl,  {
            method: "GET",
            headers: {
                Authorization: `Token token=${apiKey}`,
                "X-Api-Version": "20210218",
                "Content-Type": "application/json",
            },
        });
        let assesmentJson;
        try {
            assesmentJson = await assesment.json();
        } catch (error) {
            console.error("Error parsing assessment JSON:", error);
            assesmentJson = { data: [] };
        }
        
        // If no assessment found with new namespace, try the old "review" namespace
        if (!assesmentJson.data || assesmentJson.data.length === 0) {
            assesmentUrl = `${baseApiUrl}/candidates/${args.teamtailorId}/activities?filter[code]=review`;
            
            assesment = await fetch(assesmentUrl,  {
                method: "GET",
                headers: {
                    Authorization: `Token token=${apiKey}`,
                    "X-Api-Version": "20210218",
                    "Content-Type": "application/json",
                },
            });
            try {
                assesmentJson = await assesment.json();
            } catch (error) {
                console.error("Error parsing assessment JSON (fallback):", error);
                assesmentJson = { data: [] };
            }
        }
        
        if (!assesmentJson.data || assesmentJson.data.length === 0) return;
        try {
        const dataString = assesmentJson.data[0].attributes.data;
        if (!dataString || dataString.trim() === '') return;
        const assesmentData = JSON.parse(dataString);
        return {
            comment: assesmentData.comment,
            rating: assesmentData.rating,
            createdAt: assesmentJson.data[0].attributes["created-at"],
        };
        } catch (error) {
            console.error("Error parsing assesment data");
            console.error(error);
            throw new Error("Error parsing assesment data");
        }
       
    },

});



export const getCandidatesByUpdatedTT = internalAction({
    args: {
        updatedAtTT: v.number(),
    },
    handler: async (ctx, args) => {
        try {
            return await fetchAllPagesFromTeamtailor(`${baseApiUrl}/candidates?filter[updated-at][from]=${new Date(args.updatedAtTT).toISOString()}`) as TeamtailorCandidate[];
        } catch (error) {
            throw new Error(error instanceof Error ? error.message : "Unknown error occurred");
        }
        
    },
});

export const getJobsByUpdatedTT = internalAction({
    args: {
        updatedAtTT: v.number(),
    },
    handler: async (ctx, args) => {
        try {
            return await fetchAllPagesFromTeamtailor(`${baseApiUrl}/jobs?filter[status]=all&filter[updated-at][from]=${new Date(args.updatedAtTT).toISOString()}`) as TeamtailorJob[];
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

        //formats of titles:
        // 977633147 - Mekkonstruktör - Emhart Glass
        // 664816070 - Teknisk dokumentatör - Saab Dynamics - Peter Anderstedt - (Hanna Holm)
        // 549170262 - Systemingenjör - Saab Kockums- Andreas Karlsson - (Selma Mattsson)
        // 995924269 - Azure Infrastructure Engineer - Åhléns AB

        const titleParts = jobJson.data.attributes.title.split("-").map((part: string) => part.trim());
        const orderNumber = titleParts[0];
        const title = titleParts[1];
        const companyName = titleParts[2];
        const clientName = titleParts[3];
        const responsible = titleParts[4];

        const body = parseTeamtailorBody(jobJson.data.attributes.body);

        
        return {
            teamtailorTitle: jobJson.data.attributes.title,
            title: title,
            companyName: companyName,
            clientName: clientName,
            responsible: responsible,
            orderNumber: orderNumber,
            body: body,
            status: jobJson.data.attributes.status,
            recruiterEmail: jobJson.data.attributes["recruiter-email"],
            updatedAtTT: Date.parse(jobJson.data.attributes["updated-at"]),
            createdAtTT: Date.parse(jobJson.data.attributes["created-at"]),
            rawData: jobJson.data,
            };

        } catch (error) {
            throw new Error(error instanceof Error ? error.message : "Unknown error occurred");
        }
    },
});

export const upsertCandidateTTCacheRow = internalMutation({
    args: {
        teamtailorId: v.string(),
        name: v.string(),
        email: v.optional(v.string()),
        hasAssessment: v.boolean(),
        hasHubert: v.boolean(),
        hasResumeSummary: v.boolean(),
        hasLinkedinSummary: v.boolean(),
        updatedAt: v.number(),
        createdAt: v.number(),
    },
    handler: async (ctx, args) => {
        const candidate = await ctx.db.query("candidateTTCache").filter((q) => q.eq(q.field("teamtailorId"), args.teamtailorId)).first();
        if (candidate) {
            return await ctx.db.patch(candidate._id, {
                name: args.name,
                email: args.email,
                hasAssessment: args.hasAssessment,
                hasHubert: args.hasHubert,
                hasResumeSummary: args.hasResumeSummary,
                hasLinkedinSummary: args.hasLinkedinSummary,
                updatedAt: args.updatedAt,
                createdAt: args.createdAt,
            });
        }

        return await ctx.db.insert("candidateTTCache", {
            teamtailorId: args.teamtailorId,
            name: args.name,
            email: args.email,
            hasAssessment: args.hasAssessment,
            hasHubert: args.hasHubert,
            hasResumeSummary: args.hasResumeSummary,
            hasLinkedinSummary: args.hasLinkedinSummary,
            updatedAt: Date.now(),
            createdAt: Date.now(),
        });
},
});

export const upsertJobTTCacheRow = internalMutation({
    args: {
        teamtailorId: v.string(),
        title: v.string(),
        body: v.string(),
        status: v.string(),
        internalName: v.string(),
        updatedAt: v.number(),
        createdAt: v.number(),
    },
    handler: async (ctx, args) => {
        const job = await ctx.db.query("jobTTCache").filter((q) => q.eq(q.field("teamtailorId"), args.teamtailorId)).first();
        if (job) {
            return await ctx.db.patch(job._id, {
                title: args.title,
                body: args.body,
                updatedAt: args.updatedAt,
                createdAt: args.createdAt,
            });
        }
        return await ctx.db.insert("jobTTCache", {
            teamtailorId: args.teamtailorId,
            title: args.title,
            status: args.status,
            body: args.body,
            internalName: args.internalName,
            updatedAt: args.updatedAt,
            createdAt: args.createdAt,
        });
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
        const jobs = response.data.map((job: any) => {
            return {
                id: job.id,
                title: job.attributes.title,
                internalName: job.attributes["internal-name"],
                status: job.attributes.status,
                department: job.attributes.department,
                bodyLength: job.attributes.body.length,
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



export const listCandidatesTTCache = query({
    args: {
        paginationOpts: paginationOptsValidator,
        search: v.optional(v.string()),
        hasAssessment: v.optional(v.boolean()),
        hasHubert: v.optional(v.boolean()),
        hasResumeSummary: v.optional(v.boolean()),
        hasLinkedinSummary: v.optional(v.boolean()),
    },
    handler: async (ctx, args) => {
        const { paginationOpts, search, hasAssessment, hasHubert, hasResumeSummary, hasLinkedinSummary } = args;
        
        // Apply search filter if provided
        if (search && search.trim() !== "") {
            let query = ctx.db.query("candidateTTCache").withSearchIndex("by_name", (q) => q.search("name", search));
            
            // Apply boolean filters
            if (hasAssessment !== undefined) {
                query = query.filter((q) => q.eq(q.field("hasAssessment"), hasAssessment));
            }
            if (hasHubert !== undefined) {
                query = query.filter((q) => q.eq(q.field("hasHubert"), hasHubert));
            }
            if (hasResumeSummary !== undefined) {
                query = query.filter((q) => q.eq(q.field("hasResumeSummary"), hasResumeSummary));
            }
            if (hasLinkedinSummary !== undefined) {
                query = query.filter((q) => q.eq(q.field("hasLinkedinSummary"), hasLinkedinSummary));
            }
            
            return await query.paginate(paginationOpts);
        }
        
        // No search - use regular query with filters
        let query = ctx.db.query("candidateTTCache");
        
        // Apply boolean filters
        if (hasAssessment !== undefined) {
            query = query.filter((q) => q.eq(q.field("hasAssessment"), hasAssessment));
        }
        if (hasHubert !== undefined) {
            query = query.filter((q) => q.eq(q.field("hasHubert"), hasHubert));
        }
        if (hasResumeSummary !== undefined) {
            query = query.filter((q) => q.eq(q.field("hasResumeSummary"), hasResumeSummary));
        }
        if (hasLinkedinSummary !== undefined) {
            query = query.filter((q) => q.eq(q.field("hasLinkedinSummary"), hasLinkedinSummary));
        }
        
        return await query.order("desc").paginate(paginationOpts);
    },
});

export const listJobsTTCache = query({
    args: {
        paginationOpts: paginationOptsValidator,
        search: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const { paginationOpts, search } = args;
        
        // Apply search filter if provided
        if (search && search.trim() !== "") {
            const query = ctx.db.query("jobTTCache").withSearchIndex("by_title", (q) => q.search("title", search));
            return await query.paginate(paginationOpts);
        }
        
        // No search - use regular query
        const query = ctx.db.query("jobTTCache");
        return await query.order("desc").paginate(paginationOpts);
    },
});