import { Button, Input, Modal, Space } from "antd";
import React from "react";
import { useShowModal } from "../components/ModalManager";
import { backrestService } from "../api";
import { SpinButton } from "../components/SpinButton";
import { ConnectError } from "@connectrpc/connect";
import { useAlertApi } from "../components/Alerts";
import {
  GetOperationsRequest,
  GetOperationsRequestSchema,
  RunCommandRequest,
  RunCommandRequestSchema,
} from "../../gen/ts/v1/service_pb";
import { Repo } from "../../gen/ts/v1/config_pb";
import { OperationListView } from "../components/OperationListView";
import { create } from "@bufbuild/protobuf";
import { useConfig } from "../components/ConfigProvider";

interface Invocation {
  command: string;
  output: string;
  error: string;
}

export const RunCommandModal = ({ repo }: { repo: Repo }) => {
  const [config, _] = useConfig();
  const showModal = useShowModal();
  const alertApi = useAlertApi()!;
  const [command, setCommand] = React.useState("");
  const [running, setRunning] = React.useState(false);

  const handleCancel = () => {
    showModal(null);
  };

  const doExecute = async () => {
    if (!command) return;
    setRunning(true);

    const toRun = command.trim();
    setCommand("");

    try {
      const opID = await backrestService.runCommand(
        create(RunCommandRequestSchema, {
          repoId: repo.id!,
          command: toRun,
        })
      );
    } catch (e: any) {
      alertApi.error("命令执行失败：" + e.message);
    } finally {
      setRunning(false);
    }
  };

  return (
    <Modal
      open={true}
      onCancel={handleCancel}
      title={"在仓库 " + repo.id + " 中运行命令"}
      width="80vw"
      footer={[]}
    >
      <Space.Compact style={{ width: "100%" }}>
        <Input
          placeholder="运行 restic 命令，例如输入 'help' 查看帮助"
          value={command}
          onChange={(e) => setCommand(e.target.value)}
          onKeyUp={(e) => {
            if (e.key === "Enter") {
              doExecute();
            }
          }}
        />
        <SpinButton type="primary" onClickAsync={doExecute}>
          执行
        </SpinButton>
      </Space.Compact>
      {running && command ? (
        <em style={{ color: "gray" }}>
          警告：当前已有命令正在运行。请等待其完成后再运行需要仓库锁的其他操作。
        </em>
      ) : null}
      <OperationListView
        req={create(GetOperationsRequestSchema, {
          selector: {
            instanceId: config?.instance,
            repoGuid: repo.guid,
            planId: "_system_", // 运行命令不关联任何计划
          },
        })}
        filter={(op) => op.op.case === "operationRunCommand"}
      />
    </Modal>
  );
};