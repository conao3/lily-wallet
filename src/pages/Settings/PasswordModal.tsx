import React, { useState } from "react";
import styled, { css } from "styled-components";
import { LockAlt } from "@styled-icons/boxicons-regular";

import { StyledIcon, Input, Button } from "../../components";

import { mobile } from "../../utils/media";
import {
  white,
  yellow100,
  yellow400,
  gray500,
  green700,
} from "../../utils/colors";

interface Props {
  downloadEncryptedCurrentConfig: (password: string) => void;
  downloadUnencryptedCurrentConfig: () => void;
}

export const PasswordModal = ({
  downloadEncryptedCurrentConfig,
  downloadUnencryptedCurrentConfig,
}: Props) => {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  return (
    <ModalContentWrapper>
      <DangerIconContainer>
        <StyledIconCircle
          onDoubleClick={() => downloadUnencryptedCurrentConfig()}
        >
          <StyledIcon style={{ color: yellow400 }} as={LockAlt} size={36} />
        </StyledIconCircle>
      </DangerIconContainer>
      <DangerTextContainer>
        <DangerText>Secure your backup with a password</DangerText>
        <DangerSubtext>
          Give a password to encrypt your backup with.
        </DangerSubtext>
        <Input
          label="Password"
          placeholder="password"
          value={password}
          onChange={setPassword}
          type="password"
        />

        <Input
          style={{ marginTop: "1em" }}
          label="Confirm Password"
          placeholder="password"
          value={confirmPassword}
          onChange={setConfirmPassword}
          type="password"
        />
        <Buttons>
          <DownloadButton
            background={green700}
            color={white}
            onClick={() => downloadEncryptedCurrentConfig(password)}
          >
            Download Backup
          </DownloadButton>
        </Buttons>
      </DangerTextContainer>
    </ModalContentWrapper>
  );
};

const Buttons = styled.div`
  display: flex;
  justify-content: flex-end;
  padding: 1.5em 0 0;
  width: 100%;
`;

const DownloadButton = styled.button`
  ${Button}
`;

const ModalContentWrapper = styled.div`
  display: flex;
  flex-direction: row;
  width: 100%;
  padding: 1.5em;
  align-items: flex-start;

  ${mobile(css`
    flex-direction: column;
    align-items: center;
    padding-top: 1.25em;
    padding-bottom: 1em;
    padding-left: 1em;
    padding-right: 1em;
    margin-left: 0;
  `)};
`;

const DangerTextContainer = styled.div`
  display: flex;
  flex: 1;
  align-items: flex-start;
  flex-direction: column;
  margin-left: 1rem;

  ${mobile(css`
    margin-top: 0.75rem;
    margin-left: 0;
  `)};
`;

const DangerIconContainer = styled.div``;

const StyledIconCircle = styled.div`
  border-radius: 9999px;
  background: ${yellow100};
  width: 3rem;
  height: 3rem;
  display: flex;
  justify-content: center;
  align-items: center;
`;

const DangerText = styled.div`
  font-size: 1.125rem;
  text-align: center;
  font-weight: 600;
`;

const DangerSubtext = styled.div`
  padding-bottom: 2em;
  margin-top: 0.5rem;
  color: ${gray500};
`;
