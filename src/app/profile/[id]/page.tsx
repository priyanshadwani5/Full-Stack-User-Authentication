// 📁 src/app/profile/[id]/page.tsx
import UserProfile from "./UserProfile";

export default function ProfilePage({ params }: { params: { id: string } }) {
  return <UserProfile userId={params.id} />;
}
