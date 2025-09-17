"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Plus, Edit, Trash2, Save, X, Settings, Users, FileText } from "lucide-react";
import { toast } from "sonner";
import { api, Id } from "@/lib/convex";

interface Guideline {
  _id: Id<"scoringGuidelines">;
  name: string;
  text: string;
  createdBy: Id<"users">;
}

export default function SettingsPage() {
  const [selectedGuideline, setSelectedGuideline] = useState<Guideline | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [guidelineForm, setGuidelineForm] = useState({ name: "", text: "" });
  const [activeTab, setActiveTab] = useState("guidelines");

  const guidelines = useQuery(api.scoringGuidelines.list);
  const createGuideline = useMutation(api.scoringGuidelines.create);
  const updateGuideline = useMutation(api.scoringGuidelines.update);
  const deleteGuideline = useMutation(api.scoringGuidelines.remove);

  const handleCreateGuideline = () => {
    setIsCreating(true);
    setSelectedGuideline(null);
    setGuidelineForm({ name: "", text: "" });
  };

  const handleEditGuideline = (guideline: Guideline) => {
    setIsEditing(true);
    setSelectedGuideline(guideline);
    setGuidelineForm({ name: guideline.name, text: guideline.text });
  };

  const handleSaveGuideline = async () => {
    if (!guidelineForm.name.trim() || !guidelineForm.text.trim()) {
      toast.error("Please fill in all fields");
      return;
    }

    try {
      if (isCreating) {
        await createGuideline({
          name: guidelineForm.name.trim(),
          text: guidelineForm.text.trim(),
        });
        toast.success("Scoring guideline created successfully!");
      } else if (isEditing && selectedGuideline) {
        await updateGuideline({
          id: selectedGuideline._id,
          name: guidelineForm.name.trim(),
          text: guidelineForm.text.trim(),
        });
        toast.success("Scoring guideline updated successfully!");
      }
      setIsCreating(false);
      setIsEditing(false);
      setGuidelineForm({ name: "", text: "" });
    } catch (error) {
      console.error("Failed to save scoring guideline:", error);
      toast.error("Failed to save scoring guideline. Please try again.");
    }
  };

  const handleDeleteGuideline = async (id: Id<"scoringGuidelines">) => {
    try {
      await deleteGuideline({ id });
      toast.success("Scoring guideline deleted successfully!");
      if (selectedGuideline?._id === id) {
        setSelectedGuideline(null);
      }
    } catch (error) {
      console.error("Failed to delete scoring guideline:", error);
      toast.error("Failed to delete scoring guideline. Please try again.");
    }
  };

  const handleCancel = () => {
    setIsCreating(false);
    setIsEditing(false);
    setGuidelineForm({ name: "", text: "" });
  };

  return (
    <div className="container mx-auto py-8 px-4 max-w-7xl">

      <div className="flex gap-6">
        {/* Sidebar Navigation */}
        <div className="w-64 flex-shrink-0">
          <Card>
            <CardContent className="p-0">
              <nav className="space-y-1 p-2">
                <button
                  onClick={() => setActiveTab("general")}
                  className={`w-full flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                    activeTab === "general"
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  }`}
                >
                  <Settings className="h-4 w-4" />
                  General
                </button>
                <button
                  onClick={() => setActiveTab("users")}
                  className={`w-full flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                    activeTab === "users"
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  }`}
                >
                  <Users className="h-4 w-4" />
                  Users
                </button>
                <button
                  onClick={() => setActiveTab("guidelines")}
                  className={`w-full flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                    activeTab === "guidelines"
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  }`}
                >
                  <FileText className="h-4 w-4" />
                  Guidelines
                </button>
              </nav>
            </CardContent>
          </Card>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 space-y-6">
          {activeTab === "general" && (
            <Card>
              <CardHeader>
                <CardTitle>General Settings</CardTitle>
                <CardDescription>Configure your application preferences</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="app-name">Application Name</Label>
                    <Input id="app-name" placeholder="My Application" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="company">Company</Label>
                    <Input id="company" placeholder="Company Name" />
                  </div>
                </div>

                <Separator />

                <div className="space-y-4">
                  <h3 className="text-lg font-medium">Notifications</h3>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label>Email Notifications</Label>
                        <p className="text-sm text-muted-foreground">Receive notifications via email</p>
                      </div>
                      <Switch />
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label>Push Notifications</Label>
                        <p className="text-sm text-muted-foreground">Receive push notifications</p>
                      </div>
                      <Switch />
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label>Marketing Emails</Label>
                        <p className="text-sm text-muted-foreground">Receive marketing and promotional emails</p>
                      </div>
                      <Switch />
                    </div>
                  </div>
                </div>

                <Separator />

                <div className="flex justify-end">
                  <Button>Save Changes</Button>
                </div>
              </CardContent>
            </Card>
          )}

          {activeTab === "users" && (
            <Card>
              <CardHeader>
                <CardTitle>User Management</CardTitle>
                <CardDescription>Manage users and their permissions</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="text-center py-8 text-muted-foreground">
                    <Users className="mx-auto h-12 w-12 mb-4" />
                    <p>User management features coming soon</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {activeTab === "guidelines" && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Guidelines List */}
              <Card className="lg:col-span-1">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>Guidelines</CardTitle>
                    <Button size="sm" onClick={handleCreateGuideline}>
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                  <CardDescription>Select a guideline to view or edit</CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="space-y-1">
                    {guidelines === undefined ? (
                      <div className="space-y-2 p-3">
                        {[...Array(3)].map((_, i) => (
                          <div key={i} className="h-16 bg-muted animate-pulse rounded" />
                        ))}
                      </div>
                    ) : guidelines.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <FileText className="mx-auto h-8 w-8 mb-2" />
                        <p className="text-sm">No guidelines yet</p>
                      </div>
                    ) : (
                      guidelines.map((guideline) => (
                        <button
                          key={guideline._id}
                          onClick={() => setSelectedGuideline(guideline)}
                          className={`w-full text-left p-3 hover:bg-muted/50 transition-colors ${
                            selectedGuideline?._id === guideline._id ? "bg-muted" : ""
                          }`}
                        >
                          <p className="font-medium text-sm">{guideline.name}</p>
                          <p className="text-xs text-muted-foreground">Scoring Guideline</p>
                        </button>
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Guideline Content */}
              <Card className="lg:col-span-2">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>
                        {isCreating
                          ? "Create New Guideline"
                          : isEditing
                            ? "Edit Guideline"
                            : selectedGuideline
                              ? selectedGuideline.name
                              : "Select a Guideline"}
                      </CardTitle>
                      {selectedGuideline && !isEditing && !isCreating && (
                        <CardDescription>Scoring Guideline</CardDescription>
                      )}
                    </div>
                    {selectedGuideline && !isCreating && !isEditing && (
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => handleEditGuideline(selectedGuideline)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => handleDeleteGuideline(selectedGuideline._id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {isCreating || isEditing ? (
                    <>
                      <div className="space-y-2">
                        <Label htmlFor="guideline-title">Title</Label>
                        <Input
                          id="guideline-title"
                          value={guidelineForm.name}
                          onChange={(e) => setGuidelineForm({ ...guidelineForm, name: e.target.value })}
                          placeholder="Enter guideline title"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="guideline-content">Content</Label>
                        <Textarea
                          id="guideline-content"
                          value={guidelineForm.text}
                          onChange={(e) => setGuidelineForm({ ...guidelineForm, text: e.target.value })}
                          placeholder="Enter guideline content"
                          className="min-h-[300px] resize-none"
                        />
                      </div>
                      <div className="flex gap-2 justify-end">
                        <Button variant="outline" onClick={handleCancel}>
                          <X className="h-4 w-4 mr-2" />
                          Cancel
                        </Button>
                        <Button onClick={handleSaveGuideline}>
                          <Save className="h-4 w-4 mr-2" />
                          Save
                        </Button>
                      </div>
                    </>
                  ) : selectedGuideline ? (
                    <div className="space-y-4">
                      <Textarea
                        value={selectedGuideline.text}
                        readOnly
                        className="min-h-[300px] resize-none bg-muted/30"
                      />
                    </div>
                  ) : (
                    <div className="text-center py-12 text-muted-foreground">
                      <p>Select a guideline from the list to view its content</p>
                      <p className="text-sm mt-2">or create a new one using the + button</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
