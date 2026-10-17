import { Avatar } from "@mui/material";

import { displayName, initials } from "../lib/chatFormat";
import type { ChatUser } from "../types";

export function ChatAvatar({
  user,
  size = 40,
}: {
  user?: ChatUser | null;
  size?: number;
}) {
  return (
    <Avatar
      sx={{
        width: size,
        height: size,
        fontSize: size * 0.36,
        fontWeight: 700,
        bgcolor: "primary.main",
      }}
    >
      {initials(displayName(user))}
    </Avatar>
  );
}
