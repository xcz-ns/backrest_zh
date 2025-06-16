import React, { Suspense, useContext, useEffect, useState } from "react";
import { Repo } from "../../gen/ts/v1/config_pb";
import { Flex, Tabs, Tooltip, Typography, Button } from "antd";
import { OperationListView } from "../components/OperationListView";
import { OperationTreeView } from "../components/OperationTreeView";
import { MAX_OPERATION_HISTORY } from "../constants";
import {
  DoRepoTaskRequest_Task,
  DoRepoTaskRequestSchema,
  GetOperationsRequestSchema,
  OpSelectorSchema,
} from "../../gen/ts/v1/service_pb";
import { backrestService } from "../api";
import { SpinButton } from "../components/SpinButton";
import { useConfig } from "../components/ConfigProvider";
import { formatErrorAlert, useAlertApi } from "../components/Alerts";
import { useShowModal } from "../components/ModalManager";
import { create } from "@bufbuild/protobuf";

const StatsPanel = React.lazy(() => import("../components/StatsPanel"));

export const RepoView = ({ repo }: React.PropsWithChildren<{ repo: Repo }>) => {
  const [config, _] = useConfig();
  const showModal = useShowModal();
  const alertsApi = useAlertApi()!;

  // 任务处理函数
  const handleIndexNow = async () => {
    try {
      await backrestService.doRepoTask(
        create(DoRepoTaskRequestSchema, {
          repoId: repo.id!,
          task: DoRepoTaskRequest_Task.INDEX_SNAPSHOTS,
        })
      );
    } catch (e: any) {
      alertsApi.error(formatErrorAlert(e, "快照索引失败："));
    }
  };

  const handleUnlockNow = async () => {
    try {
      alertsApi.info("正在解锁仓库...");
      await backrestService.doRepoTask(
        create(DoRepoTaskRequestSchema, {
          repoId: repo.id!,
          task: DoRepoTaskRequest_Task.UNLOCK,
        })
      );
      alertsApi.success("仓库已解锁。");
    } catch (e: any) {
      alertsApi.error("仓库解锁失败：" + e.message);
    }
  };

  const handleStatsNow = async () => {
    try {
      await backrestService.doRepoTask(
        create(DoRepoTaskRequestSchema, {
          repoId: repo.id!,
          task: DoRepoTaskRequest_Task.STATS,
        })
      );
    } catch (e: any) {
      alertsApi.error(formatErrorAlert(e, "统计计算失败："));
    }
  };

  const handlePruneNow = async () => {
    try {
      await backrestService.doRepoTask(
        create(DoRepoTaskRequestSchema, {
          repoId: repo.id!,
          task: DoRepoTaskRequest_Task.PRUNE,
        })
      );
    } catch (e: any) {
      alertsApi.error(formatErrorAlert(e, "清理操作失败："));
    }
  };

  const handleCheckNow = async () => {
    try {
      await backrestService.doRepoTask(
        create(DoRepoTaskRequestSchema, {
          repoId: repo.id!,
          task: DoRepoTaskRequest_Task.CHECK,
        })
      );
    } catch (e: any) {
      alertsApi.error(formatErrorAlert(e, "校验失败："));
    }
  };

  // 安全检查当前仓库是否仍在配置中
  let repoInConfig = config?.repos?.find((r) => r.id === repo.id);
  if (!repoInConfig) {
    return (
      <>
        该仓库已被删除
        <pre>{JSON.stringify(config, null, 2)}</pre>
      </>
    );
  }
  repo = repoInConfig;

  const items = [
    {
      key: "1",
      label: "树状视图",
      children: (
        <>
          <OperationTreeView
            req={create(GetOperationsRequestSchema, {
              selector: {
                repoGuid: repo.guid,
              },
              lastN: BigInt(MAX_OPERATION_HISTORY),
            })}
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
          <h3>备份操作历史</h3>
          <OperationListView
            req={create(GetOperationsRequestSchema, {
              selector: {
                repoGuid: repo.guid,
              },
              lastN: BigInt(MAX_OPERATION_HISTORY),
            })}
            showPlan={true}
            showDelete={true}
          />
        </>
      ),
      destroyInactiveTabPane: true,
    },
    {
      key: "3",
      label: "统计信息",
      children: (
        <Suspense fallback={<div>加载中...</div>}>
          <StatsPanel
            selector={create(OpSelectorSchema, {
              repoGuid: repo.guid,
              instanceId: config?.instance,
            })}
          />
        </Suspense>
      ),
      destroyInactiveTabPane: true,
    },
  ];

  return (
    <>
      <Flex gap="small" align="center" wrap="wrap">
        <Typography.Title>{repo.id}</Typography.Title>
      </Flex>

      <Flex gap="small" align="center" wrap="wrap">
        <Tooltip title="高级用户：打开 restic 命令行以运行仓库命令。执行命令后建议重新索引快照以同步 Backrest 数据">
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

        <Tooltip title="对仓库中的快照进行索引。每次备份完成后也会自动执行此操作">
          <SpinButton type="default" onClickAsync={handleIndexNow}>
            快照索引
          </SpinButton>
        </Tooltip>

        <Tooltip title="移除仓库锁文件，并检查仓库错误。仅在确认仓库未被其他系统使用时执行">
          <SpinButton type="default" onClickAsync={handleUnlockNow}>
            解锁仓库
          </SpinButton>
        </Tooltip>

        <Tooltip title="对仓库执行清理操作，将删除旧快照并释放空间">
          <SpinButton type="default" onClickAsync={handlePruneNow}>
            立即清理
          </SpinButton>
        </Tooltip>

        <Tooltip title="对仓库执行完整性校验">
          <SpinButton type="default" onClickAsync={handleCheckNow}>
            立即校验
          </SpinButton>
        </Tooltip>

        <Tooltip title="对仓库运行 restic stats 统计，这可能是一个耗时操作">
          <SpinButton type="default" onClickAsync={handleStatsNow}>
            计算统计信息
          </SpinButton>
        </Tooltip>
      </Flex>

      <Tabs defaultActiveKey={items[0].key} items={items} />
    </>
  );
};