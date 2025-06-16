import React, { useEffect, useState } from "react";
import { Plan } from "../../gen/ts/v1/config_pb";
import { Button, Flex, Tabs, Tooltip, Typography } from "antd";
import { useAlertApi } from "../components/Alerts";
import { MAX_OPERATION_HISTORY } from "../constants";
import { backrestService } from "../api";
import {
  ClearHistoryRequestSchema,
  DoRepoTaskRequest_Task,
  DoRepoTaskRequestSchema,
  GetOperationsRequestSchema,
} from "../../gen/ts/v1/service_pb";
import { SpinButton } from "../components/SpinButton";
import { useShowModal } from "../components/ModalManager";
import { create } from "@bufbuild/protobuf";
import { useConfig } from "../components/ConfigProvider";
import { OperationListView } from "../components/OperationListView";
import { OperationTreeView } from "../components/OperationTreeView";

export const PlanView = ({ plan }: React.PropsWithChildren<{ plan: Plan }>) => {
  const [config, _] = useConfig();
  const alertsApi = useAlertApi()!;
  const showModal = useShowModal();
  const repo = config?.repos.find((r) => r.id === plan.repo);

  const handleBackupNow = async () => {
    try {
      await backrestService.backup({ value: plan.id });
      alertsApi.success("备份已安排");
    } catch (e: any) {
      alertsApi.error("备份安排失败：" + e.message);
    }
  };

  const handleUnlockNow = async () => {
    try {
      alertsApi.info("正在解锁仓库...");
      await backrestService.doRepoTask(
        create(DoRepoTaskRequestSchema, {
          repoId: plan.repo!,
          task: DoRepoTaskRequest_Task.UNLOCK,
        })
      );
      alertsApi.success("仓库已解锁");
    } catch (e: any) {
      alertsApi.error("仓库解锁失败：" + e.message);
    }
  };

  const handleClearErrorHistory = async () => {
    try {
      alertsApi.info("清除错误历史...");
      await backrestService.clearHistory(
        create(ClearHistoryRequestSchema, {
          selector: {
            planId: plan.id,
            repoGuid: repo!.guid,
          },
          onlyFailed: true,
        })
      );
      alertsApi.success("错误历史已清除");
    } catch (e: any) {
      alertsApi.error("错误历史清除失败：" + e.message);
    }
  };

  if (!repo) {
    return (
      <>
        <Typography.Title>
          计划 {plan.id} 的仓库 {plan.repo} 未找到
        </Typography.Title>
      </>
    );
  }

  return (
    <>
      <Flex gap="small" align="center" wrap="wrap">
        <Typography.Title>{plan.id}</Typography.Title>
      </Flex>
      <Flex gap="small" align="center" wrap="wrap">
        <SpinButton type="primary" onClickAsync={handleBackupNow}>
          立即备份
        </SpinButton>
        <Tooltip title="高级用户：打开restic命令行执行仓库操作。修改后需重新索引快照以在Backrest中生效">
          <Button
            type="default"
            onClick={async () => {
              const { RunCommandModal } = await import("./RunCommandModal");
              showModal(<RunCommandModal repo={repo} />);
            }}
          >
            运行命令
          </Button>
        </Tooltip>
        <Tooltip title="移除锁文件并检查仓库错误。请确保仓库未被其他系统访问时执行">
          <SpinButton type="default" onClickAsync={handleUnlockNow}>
            解锁仓库
          </SpinButton>
        </Tooltip>
        <Tooltip title="从列表中移除失败的操作记录">
          <SpinButton type="default" onClickAsync={handleClearErrorHistory}>
            清除错误历史
          </SpinButton>
        </Tooltip>
      </Flex>
      <Tabs
        defaultActiveKey="1"
        items={[
          {
            key: "1",
            label: "树状视图",
            children: (
              <>
                <OperationTreeView
                  req={create(GetOperationsRequestSchema, {
                    selector: {
                      instanceId: config?.instance,
                      repoGuid: repo.guid,
                      planId: plan.id!,
                    },
                    lastN: BigInt(MAX_OPERATION_HISTORY),
                  })}
                  isPlanView={true}
                />
              </>
            ),
            destroyInactiveTabPane: true,
          },
          {
            key: "2",
            label: "列表视图",
            children: (
              <>
                <h2>备份操作历史</h2>
                <OperationListView
                  req={create(GetOperationsRequestSchema, {
                    selector: {
                      instanceId: config?.instance,
                      repoGuid: repo.guid,
                      planId: plan.id!,
                    },
                    lastN: BigInt(MAX_OPERATION_HISTORY),
                  })}
                  showDelete={true}
                />
              </>
            ),
            destroyInactiveTabPane: true,
          },
        ]}
      />
    </>
  );
};