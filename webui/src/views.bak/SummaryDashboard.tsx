import {
  Button,
  Card,
  Col,
  Collapse,
  Descriptions,
  Divider,
  Empty,
  Flex,
  Row,
  Spin,
  Typography,
} from "antd";
import React, { useEffect, useState } from "react";
import { useConfig } from "../components/ConfigProvider";
import {
  SummaryDashboardResponse,
  SummaryDashboardResponse_Summary,
} from "../../gen/ts/v1/service_pb";
import { backrestService } from "../api";
import { useAlertApi } from "../components/Alerts";
import {
  formatBytes,
  formatDate,
  formatDuration,
  formatTime,
} from "../lib/formatting";
import {
  Bar,
  BarChart,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { colorForStatus } from "../state/flowdisplayaggregator";
import { OperationStatus } from "../../gen/ts/v1/operations_pb";
import { isMobile } from "../lib/browserutil";
import { useNavigate } from "react-router";
import { toJsonString } from "@bufbuild/protobuf";
import { ConfigSchema } from "../../gen/ts/v1/config_pb";

export const SummaryDashboard = () => {
  const config = useConfig()[0];
  const alertApi = useAlertApi()!;
  const navigate = useNavigate();

  const [summaryData, setSummaryData] = useState<SummaryDashboardResponse | null>();

  useEffect(() => {
    // 获取摘要数据
    const fetchData = async () => {
      if (document.hidden) {
        return;
      }

      try {
        const data = await backrestService.getSummaryDashboard({});
        setSummaryData(data);
      } catch (e) {
        alertApi.error("获取摘要数据失败: " + e);
      }
    };

    fetchData();

    const interval = setInterval(fetchData, 60000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!config) {
      return;
    }

    if (config.repos.length === 0 && config.plans.length === 0) {
      navigate("/getting-started");
    }
  }, [config]);

  if (!summaryData) {
    return <Spin />;
  }

  return (
    <>
      <Flex gap={16} vertical>
        <Typography.Title level={3}>存储库</Typography.Title>
        {summaryData.repoSummaries.length > 0 ? (
          summaryData.repoSummaries.map((summary) => (
            <SummaryPanel summary={summary} key={summary.id} />
          ))
        ) : (
          <Empty description="未找到存储库" />
        )}

        <Typography.Title level={3}>计划</Typography.Title>
        {summaryData.planSummaries.length > 0 ? (
          summaryData.planSummaries.map((summary) => (
            <SummaryPanel summary={summary} key={summary.id} />
          ))
        ) : (
          <Empty description="未找到计划" />
        )}

        <Divider />
        <Typography.Title level={3}>系统信息</Typography.Title>
        <Descriptions
          layout="vertical"
          column={2}
          items={[
            {
              key: 1,
              label: "配置文件路径",
              children: summaryData.configPath,
            },
            {
              key: 2,
              label: "数据目录",
              children: summaryData.dataPath,
            },
          ]}
        />

        <Collapse
          size="small"
          items={[
            {
              label: "配置 JSON 格式",
              children: (
                <pre>
                  {config &&
                    toJsonString(ConfigSchema, config, { prettySpaces: 2 })}
                </pre>
              ),
            },
          ]}
        />
      </Flex>
    </>
  );
};

const SummaryPanel = ({
  summary,
}: {
  summary: SummaryDashboardResponse_Summary;
}) => {
  const recentBackupsChart: {
    idx: number;
    time: number;
    durationMs: number;
    color: string;
    bytesAdded: number;
  }[] = [];
  const recentBackups = summary.recentBackups!;
  for (let i = 0; i < recentBackups.timestampMs.length; i++) {
    const color = colorForStatus(recentBackups.status[i]);
    recentBackupsChart.push({
      idx: i,
      time: Number(recentBackups.timestampMs[i]),
      durationMs: Number(recentBackups.durationMs[i]),
      color: color,
      bytesAdded: Number(recentBackups.bytesAdded[i]),
    });
  }
  while (recentBackupsChart.length < 60) {
    recentBackupsChart.push({
      idx: recentBackupsChart.length,
      time: 0,
      durationMs: 0,
      color: "white",
      bytesAdded: 0,
    });
  }

  const BackupChartTooltip = ({ active, payload, label }: any) => {
    const idx = Number(label);

    const entry = recentBackupsChart[idx];
    if (!entry || entry.idx > recentBackups.timestampMs.length) {
      return null;
    }

    const isPending =
      recentBackups.status[idx] === OperationStatus.STATUS_PENDING;

    return (
      <Card style={{ opacity: 0.9 }} size="small" key={label}>
        <Typography.Text>备份时间：{formatTime(entry.time)}</Typography.Text>{" "}
        <br />
        {isPending ? (
          <Typography.Text type="secondary">
            已安排，等待执行。
          </Typography.Text>
        ) : (
          <Typography.Text type="secondary">
            耗时 {formatDuration(entry.durationMs)}，新增数据量{" "}
            {formatBytes(entry.bytesAdded)}
          </Typography.Text>
        )}
      </Card>
    );
  };

  const cardInfo: { key: number; label: string; children: React.ReactNode }[] = [];

  cardInfo.push(
    {
      key: 1,
      label: "最近 30 天备份次数",
      children: (
        <>
          {summary.backupsSuccessLast30days ? (
            <Typography.Text type="success" style={{ marginRight: "5px" }}>
              {summary.backupsSuccessLast30days} 次成功
            </Typography.Text>
          ) : undefined}
          {summary.backupsFailed30days ? (
            <Typography.Text type="danger" style={{ marginRight: "5px" }}>
              {summary.backupsFailed30days} 次失败
            </Typography.Text>
          ) : undefined}
          {summary.backupsWarningLast30days ? (
            <Typography.Text type="warning" style={{ marginRight: "5px" }}>
              {summary.backupsWarningLast30days} 次警告
            </Typography.Text>
          ) : undefined}
        </>
      ),
    },
    {
      key: 2,
      label: "扫描字节数（30天）",
      children: formatBytes(Number(summary.bytesScannedLast30days)),
    },
    {
      key: 3,
      label: "新增字节数（30天）",
      children: formatBytes(Number(summary.bytesAddedLast30days)),
    }
  );

  // 判断是否是移动端布局
  if (!isMobile()) {
    cardInfo.push(
      {
        key: 4,
        label: "下次计划备份时间",
        children: summary.nextBackupTimeMs
          ? formatTime(Number(summary.nextBackupTimeMs))
          : "无计划",
      },
      {
        key: 5,
        label: "平均扫描字节数",
        children: formatBytes(Number(summary.bytesScannedAvg)),
      },
      {
        key: 6,
        label: "平均新增字节数",
        children: formatBytes(Number(summary.bytesAddedAvg)),
      }
    );
  }

  return (
    <Card title={summary.id} style={{ width: "100%" }}>
      <Row gutter={16}>
        <Col span={10}>
          <Descriptions layout="vertical" column={3} items={cardInfo} />
        </Col>
        <Col span={14}>
          <ResponsiveContainer width="100%" height={140}>
            <BarChart data={recentBackupsChart}>
              <Bar dataKey="durationMs">
                {recentBackupsChart.map((entry, index) => (
                  <Cell cursor="pointer" fill={entry.color} key={`${index}`} />
                ))}
              </Bar>
              <YAxis dataKey="durationMs" hide />
              <XAxis dataKey="idx" hide />
              <Tooltip content={<BackupChartTooltip />} cursor={false} />
            </BarChart>
          </ResponsiveContainer>
        </Col>
      </Row>
    </Card>
  );
};