"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import UserManagementTab from "@/components/dashboard/sub-user-management/UserManagementTab";
import UserAccessTab from "@/components/dashboard/sub-user-management/UserAccessTab";

export default function UserManagementPage() {
  return (
    <div className="flex-1 p-4">
      <Card>
        <CardHeader>
          <CardTitle>User Management</CardTitle>
          <CardDescription>
            Manage and control user access to the system.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="user-management">
            <TabsList>
              <TabsTrigger value="user-management">User Management</TabsTrigger>
              <TabsTrigger value="user-access">User Access</TabsTrigger>
            </TabsList>
            <TabsContent value="user-management">
              <UserManagementTab />
            </TabsContent>
            <TabsContent value="user-access">
              <UserAccessTab />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}