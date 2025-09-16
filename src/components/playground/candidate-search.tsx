import { api, Doc } from "@/lib/convex";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";
import { CommandGroup, CommandItem, CommandEmpty, Command,  CommandList, CommandInput } from "../ui/command";
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "../ui/dialog";
import { useQuery } from "convex/react";
import { useState } from "react";
import { useDebounce } from "@/hooks/use-debounce";

interface CandidateSearchProps {

  onSelect: (candidate: Doc<"candidates">) => void;
  children: React.ReactNode;
  
}

export const CandidateSearch = ({ onSelect, children }: CandidateSearchProps) => {
const [search, setSearch] = useState<string>("");
const [open, setOpen] = useState<boolean>(false);
const debouncedSearch = useDebounce(search, 500);
const candidates = useQuery(api.candidates.search, { search: debouncedSearch });


  return (
    <Dialog open={open} onOpenChange={setOpen}>
    <DialogTrigger asChild>
        {children}
    </DialogTrigger>    
    <DialogContent className="p-0 overflow-hidden">
      <DialogTitle className="sr-only">Select Candidate</DialogTitle>
      <Command>
        <CommandInput placeholder="Search candidates..." onValueChange={setSearch}/>
        <CommandList>
          <CommandEmpty>No candidates found.</CommandEmpty>
          <CommandGroup heading="Candidates">
            {candidates?.map((candidate) => (
              <CommandItem
                key={candidate._id}
                value={candidate.name}
                onSelect={() => { onSelect(candidate);
                    setOpen(false);
                 }}
                className="py-3 h-12"
              >
                <div className="flex items-center justify-between w-full">
                  <div className="flex items-center gap-2 min-w-0">
                    <Avatar className="h-8 w-8">
                      {candidate.imageUrl ? (
                        <AvatarImage src={candidate.imageUrl} alt={candidate.name} />
                      ) : null}
                      <AvatarFallback className="text-[10px]">{candidate.name.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <span className="truncate">{candidate.name}</span>
                  </div>
                  <span className="text-xs text-neutral-500 ml-3">{new Date(candidate.updatedAt ?? candidate._creationTime).toLocaleDateString()}</span>
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
