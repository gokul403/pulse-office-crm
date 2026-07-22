import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Loader2, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";

type Comment = {
  id: string;
  content: string;
  created_at: string;
  author_name: string | null;
  author_avatar: string | null;
  user_id: string;
};

export function IssueComments({ issueId }: { issueId: string }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [content, setContent] = useState("");

  const commentsQ = useQuery<Comment[]>({
    queryKey: ["issue-comments", issueId],
    queryFn: () => api.get(`/issues/${issueId}/comments`),
  });

  const postMutation = useMutation({
    mutationFn: async (commentText: string) => {
      return api.post(`/issues/${issueId}/comments`, { content: commentText });
    },
    onSuccess: () => {
      setContent("");
      qc.invalidateQueries({ queryKey: ["issue-comments", issueId] });
      toast.success("Comment added");
    },
    onError: (err: any) => toast.error(err.message || "Failed to post comment"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (commentId: string) => {
      return api.delete(`/issues/comments/${commentId}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["issue-comments", issueId] });
      toast.success("Comment deleted");
    },
    onError: (err: any) => toast.error(err.message || "Failed to delete comment"),
  });

  const handlePostComment = () => {
    if (!content.trim()) return;
    postMutation.mutate(content);
  };

  const initials = (name: string | null) => {
    if (!name) return "?";
    return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
  };

  return (
    <div className="pt-4 border-t space-y-4">
      <h5 className="font-semibold text-sm text-foreground">Comments & Updates</h5>
      
      {/* Comments List */}
      <div className="space-y-3 max-h-56 overflow-y-auto pr-1">
        {commentsQ.isLoading ? (
          <div className="flex justify-center py-4">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : !commentsQ.data || commentsQ.data.length === 0 ? (
          <p className="text-xs text-muted-foreground italic text-center py-2">
            No comments yet. Start the conversation!
          </p>
        ) : (
          commentsQ.data.map((c) => (
            <div key={c.id} className="flex gap-2.5 items-start text-xs group">
              <Avatar className="h-6 w-6">
                <AvatarFallback className="bg-primary/10 text-primary font-semibold text-[10px]">
                  {initials(c.author_name)}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 bg-muted/40 p-2 rounded relative">
                <div className="flex justify-between items-center mb-1">
                  <span className="font-medium text-foreground">{c.author_name || "Unknown User"}</span>
                  <span className="text-[10px] text-muted-foreground">
                    {format(new Date(c.created_at), "MMM d, yyyy h:mm a")}
                  </span>
                </div>
                <p className="text-muted-foreground whitespace-pre-wrap leading-normal">
                  {c.content}
                </p>
                {(user?.id === c.user_id || user?.role === "admin") && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity h-5 w-5 text-muted-foreground hover:text-destructive"
                    onClick={() => {
                      if (confirm("Delete this comment?")) {
                        deleteMutation.mutate(c.id);
                      }
                    }}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Post a Comment Div (Not a nested form) */}
      <div className="flex gap-2">
        <Textarea
          placeholder="Add a comment or update..."
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={2}
          className="text-xs resize-none flex-1"
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handlePostComment();
            }
          }}
        />
        <Button
          type="button"
          size="sm"
          className="self-end h-8"
          disabled={postMutation.isPending || !content.trim()}
          onClick={handlePostComment}
        >
          Post
        </Button>
      </div>
    </div>
  );
}
