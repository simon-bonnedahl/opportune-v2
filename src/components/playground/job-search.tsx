import { api, Doc } from "@/lib/convex";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";
import { CommandGroup, CommandItem, CommandEmpty, Command,  CommandList, CommandInput } from "../ui/command";
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "../ui/dialog";
import { useQuery } from "convex/react";
import { useState } from "react";
import { useDebounce } from "@/hooks/use-debounce";

interface JobSearchProps {

  onSelect: (job: Doc<"jobs">) => void;
  children: React.ReactNode;
  
}

export const JobSearch = ({ onSelect, children }: JobSearchProps) => {
const [search, setSearch] = useState<string>("");
const [open, setOpen] = useState<boolean>(false);
const debouncedSearch = useDebounce(search, 500);
const jobs = useQuery(api.jobs.search, { search: debouncedSearch });


  return (
    <Dialog open={open} onOpenChange={setOpen}>
    <DialogTrigger asChild>
        {children}
    </DialogTrigger>    
    <DialogContent className="p-0 overflow-hidden">
      <DialogTitle className="sr-only">Select Candidate</DialogTitle>
      <Command>
        <CommandInput placeholder="Search jobs..." onValueChange={setSearch}/>
        <CommandList>
          <CommandEmpty>No jobs found.</CommandEmpty>
          <CommandGroup heading="Jobs">
            {jobs?.map((job) => (
              <CommandItem
                key={job._id}
                value={job.title}
                onSelect={() => { onSelect(job);
                    setOpen(false);
                 }}
                className="py-3 h-12"
              >
                <div className="flex items-center justify-between w-full">
                  <div className="flex items-center gap-2 min-w-0">
                    <Avatar className="h-8 w-8">
                      
                      <AvatarFallback className="text-[10px]">{job.title?.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <span className="truncate">{job.title}</span>
                  </div>
                  <span className="text-xs text-neutral-500 ml-3">{new Date(job.updatedAt ?? job._creationTime).toLocaleDateString()}</span>
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>  
      </Command>
    </DialogContent>
  </Dialog>
);
};
