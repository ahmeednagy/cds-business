import { forwardRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  IconButton,
  InputAdornment,
  TextField,
  type TextFieldProps,
} from "@mui/material";
import VisibilityOffOutlinedIcon from "@mui/icons-material/VisibilityOffOutlined";
import VisibilityOutlinedIcon from "@mui/icons-material/VisibilityOutlined";

const PasswordField = forwardRef<HTMLInputElement, TextFieldProps>(
  function PasswordField(props, ref) {
    const { t } = useTranslation();
    const [show, setShow] = useState(false);
    return (
      <TextField
        {...props}
        inputRef={ref}
        type={show ? "text" : "password"}
        slotProps={{
          ...props.slotProps,
          input: {
            ...props.slotProps?.input,
            endAdornment: (
              <InputAdornment position="end">
                <IconButton
                  onClick={() => setShow((s) => !s)}
                  aria-label={t(show ? "auth.hidePassword" : "auth.showPassword")}
                  aria-pressed={show}
                  edge="end"
                >
                  {show ? (
                    <VisibilityOffOutlinedIcon />
                  ) : (
                    <VisibilityOutlinedIcon />
                  )}
                </IconButton>
              </InputAdornment>
            ),
          },
        }}
      />
    );
  },
);

export default PasswordField;
