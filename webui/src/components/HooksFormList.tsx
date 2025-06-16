import React, { useState } from "react";
import {
  Hook_Condition,
  Hook_ConditionSchema,
  Hook_OnError,
  Hook_OnErrorSchema,
} from "../../gen/ts/v1/config_pb";
import {
  Button,
  Card,
  Form,
  FormListFieldData,
  Input,
  Popover,
  Select,
  Tooltip,
} from "antd";
import { MinusCircleOutlined, PlusOutlined } from "@ant-design/icons";
import { Rule } from "antd/es/form";
export interface HookFormData {
  hooks: {
    conditions: string[];
  }[];
}
export interface HookFields {
  conditions: string[];
  actionCommand?: any;
  actionGotify?: any;
  actionDiscord?: any;
  actionWebhook?: any;
  actionSlack?: any;
  actionShoutrrr?: any;
  actionHealthchecks?: any;
}
export const hooksListTooltipText = (
  <>
    钩子允许您配置在备份生命周期响应时运行的操作，例如通知和脚本。请参阅{" "}
    <a
      href="https://garethgeorge.github.io/backrest/docs/hooks" 
      target="_blank"
    >
      钩子文档
    </a>{" "}
    查看可用选项，或查阅
    <a
      href="https://garethgeorge.github.io/backrest/cookbooks/command-hook-examples" 
      target="_blank"
    >
      操作指南
    </a>
    获取脚本示例。
  </>
);
/**
 * HooksFormList 是一个 UI 组件，用于编辑可在仓库级别或计划级别应用的钩子列表。
 */
export const HooksFormList = () => {
  const form = Form.useFormInstance();
  return (
    <Form.List name="hooks">
      {(fields, { add, remove }, { errors }) => (
        <>
          {fields.map((field, index) => {
            const hookData = form.getFieldValue([
              "hooks",
              field.name,
            ]) as HookFields;
            return (
              <Card
                key={index}
                title={
                  <>
                    钩子 {index} {findHookTypeName(hookData)}
                    <MinusCircleOutlined
                      className="dynamic-delete-button"
                      onClick={() => remove(field.name)}
                      style={{
                        marginRight: "5px",
                        marginTop: "2px",
                        float: "right",
                      }}
                    />
                  </>
                }
                size="small"
                style={{ marginBottom: "5px" }}
              >
                <HookConditionsTooltip>
                  <Form.Item name={[field.name, "conditions"]}>
                    <Select
                      mode="multiple"
                      allowClear
                      style={{ width: "100%" }}
                      placeholder="运行条件..."
                      options={Hook_ConditionSchema.values.map((v) => ({
                        label: v.name,
                        value: v.name,
                      }))}
                    />
                  </Form.Item>
                </HookConditionsTooltip>
                <Form.Item
                  shouldUpdate={(prevValues, curValues) => {
                    return prevValues.hooks[index] !== curValues.hooks[index];
                  }}
                >
                  <HookBuilder field={field} />
                </Form.Item>
              </Card>
            );
          })}
          <Form.Item>
            <Popover
              content={
                <>
                  {hookTypes.map((hookType, index) => {
                    return (
                      <Button
                        key={index}
                        onClick={() => {
                          add(structuredClone(hookType.template));
                        }}
                      >
                        {hookType.name}
                      </Button>
                    );
                  })}
                </>
              }
              style={{ width: "60%" }}
              placement="bottom"
            >
              <Button
                type="dashed"
                icon={<PlusOutlined />}
                style={{ width: "100%" }}
              >
                添加钩子
              </Button>
            </Popover>
            <Form.ErrorList errors={errors} />
          </Form.Item>
        </>
      )}
    </Form.List>
  );
};
const hookTypes: {
  name: string;
  template: HookFields;
  oneofKey: string;
  component: ({ field }: { field: FormListFieldData }) => React.ReactNode;
}[] = [
  {
    name: "命令",
    template: {
      actionCommand: {
        command: "echo {{ .ShellEscape .Summary }}",
      },
      conditions: [],
    },
    oneofKey: "actionCommand",
    component: ({ field }: { field: FormListFieldData }) => {
      return (
        <>
          <Tooltip title="要执行的脚本">脚本：</Tooltip>
          <Form.Item
            name={[field.name, "actionCommand", "command"]}
            rules={[requiredField("命令是必填项")]}
          >
            <Input.TextArea
              style={{ width: "100%", fontFamily: "monospace" }}
            />
          </Form.Item>
          <ItemOnErrorSelector field={field} />
        </>
      );
    },
  },
  {
    name: "Shoutrrr",
    template: {
      actionShoutrrr: {
        template: "{{ .Summary }}",
      },
      conditions: [],
    },
    oneofKey: "actionShoutrrr",
    component: ({ field }: { field: FormListFieldData }) => {
      return (
        <>
          <Form.Item
            name={[field.name, "actionShoutrrr", "shoutrrrUrl"]}
            rules={[requiredField("Shoutrrr URL 是必填项")]}
          >
            <Input
              addonBefore={
                <Tooltip
                  title={
                    <>
                      Shoutrrr 是一个多平台通知服务,{" "}
                      <a
                        href="https://containrrr.dev/shoutrrr/v0.8/services/overview/" 
                        target="_blank"
                      >
                        查看文档
                      </a>{" "}
                      了解支持的服务
                    </>
                  }
                >
                  <div style={{ width: "8em" }}>Shoutrrr URL</div>
                </Tooltip>
              }
            />
          </Form.Item>
          文本模板：
          <Form.Item name={[field.name, "actionShoutrrr", "template"]}>
            <Input.TextArea
              style={{ width: "100%", fontFamily: "monospace" }}
            />
          </Form.Item>
        </>
      );
    },
  },
  {
    name: "Discord",
    template: {
      actionDiscord: {
        webhookUrl: "",
        template: "{{ .Summary }}",
      },
      conditions: [],
    },
    oneofKey: "actionDiscord",
    component: ({ field }: { field: FormListFieldData }) => {
      return (
        <>
          <Form.Item
            name={[field.name, "actionDiscord", "webhookUrl"]}
            rules={[requiredField("Webhook URL 是必填项")]}
          >
            <Input
              addonBefore={<div style={{ width: "8em" }}>Discord Webhook</div>}
            />
          </Form.Item>
          文本模板：
          <Form.Item name={[field.name, "actionDiscord", "template"]}>
            <Input.TextArea
              style={{ width: "100%", fontFamily: "monospace" }}
            />
          </Form.Item>
        </>
      );
    },
  },
  {
    name: "Gotify",
    template: {
      actionGotify: {
        baseUrl: "",
        token: "",
        template: "{{ .Summary }}",
        titleTemplate:
          "Backrest {{ .EventName .Event }} in plan {{ .Plan.Id }}",
        priority: 5,
      },
      conditions: [],
    },
    oneofKey: "actionGotify",
    component: ({ field }: { field: FormListFieldData }) => {
      return (
        <>
          <Form.Item
            name={[field.name, "actionGotify", "baseUrl"]}
            rules={[
              requiredField("Gotify 基础 URL 是必填项"),
              { type: "string" },
            ]}
          >
            <Input
              addonBefore={<div style={{ width: "8em" }}>Gotify 基础 URL</div>}
            />
          </Form.Item>
          <Form.Item
            name={[field.name, "actionGotify", "token"]}
            rules={[requiredField("Gotify 令牌是必填项")]}
          >
            <Input
              addonBefore={<div style={{ width: "8em" }}>Gotify 令牌</div>}
            />
          </Form.Item>
          <Form.Item
            name={[field.name, "actionGotify", "titleTemplate"]}
            rules={[requiredField("Gotify 标题模板是必填项")]}
          >
            <Input
              addonBefore={<div style={{ width: "8em" }}>标题模板</div>}
            />
          </Form.Item>
          文本模板：
          <Form.Item name={[field.name, "actionGotify", "template"]}>
            <Input.TextArea
              style={{ width: "100%", fontFamily: "monospace" }}
            />
          </Form.Item>
          <Form.Item name={[field.name, "actionGotify", "priority"]}>
            <Select
              allowClear
              style={{ width: "100%" }}
              placeholder={"设置优先级"}
              options={[
                { label: "0 - 无通知", value: 0 },
                { label: "1 - 通知栏图标", value: 1 },
                { label: "4 - 通知栏图标+声音", value: 4 },
                { label: "8 - 通知栏图标+声音+震动", value: 8 },
              ]}
            />
          </Form.Item>
        </>
      );
    },
  },
  {
    name: "Slack",
    template: {
      actionSlack: {
        webhookUrl: "",
        template: "{{ .Summary }}",
      },
      conditions: [],
    },
    oneofKey: "actionSlack",
    component: ({ field }: { field: FormListFieldData }) => {
      return (
        <>
          <Form.Item
            name={[field.name, "actionSlack", "webhookUrl"]}
            rules={[requiredField("Webhook URL 是必填项")]}
          >
            <Input
              addonBefore={<div style={{ width: "8em" }}>Slack Webhook</div>}
            />
          </Form.Item>
          文本模板：
          <Form.Item name={[field.name, "actionSlack", "template"]}>
            <Input.TextArea
              style={{ width: "100%", fontFamily: "monospace" }}
            />
          </Form.Item>
        </>
      );
    },
  },
  {
    name: "Healthchecks",
    template: {
      actionHealthchecks: {
        webhookUrl: "",
        template: "{{ .Summary }}",
      },
      conditions: [],
    },
    oneofKey: "actionHealthchecks",
    component: ({ field }: { field: FormListFieldData }) => {
      return (
        <>
          <Form.Item
            name={[field.name, "actionHealthchecks", "webhookUrl"]}
            rules={[requiredField("Ping URL 是必填项")]}
          >
            <Input addonBefore={<div style={{ width: "8em" }}>Ping URL</div>} />
          </Form.Item>
          文本模板：
          <Form.Item name={[field.name, "actionHealthchecks", "template"]}>
            <Input.TextArea
              style={{ width: "100%", fontFamily: "monospace" }}
            />
          </Form.Item>
        </>
      );
    },
  },
];
const findHookTypeName = (field: HookFields): string => {
  if (!field) {
    return "未知";
  }
  for (const hookType of hookTypes) {
    if (hookType.oneofKey in field) {
      return hookType.name;
    }
  }
  return "未知";
};
const HookBuilder = ({ field }: { field: FormListFieldData }) => {
  const form = Form.useFormInstance();
  const hookData = form.getFieldValue(["hooks", field.name]) as HookFields;
  if (!hookData) {
    return <p>未知钩子类型</p>;
  }
  for (const hookType of hookTypes) {
    if (hookType.oneofKey in hookData) {
      return hookType.component({ field });
    }
  }
  return <p>未知钩子类型</p>;
};
const ItemOnErrorSelector = ({ field }: { field: FormListFieldData }) => {
  return (
    <>
      <Tooltip
        title={
          <>
            钩子失败时的行为（仅对启动钩子有效，例如备份开始、清理开始、检查开始）
            <ul>
              <li>
                忽略 - 忽略失败，后续钩子和备份操作将正常运行。
              </li>
              <li>
                致命 - 停止备份并标记为错误状态（触发错误通知）。跳过所有后续钩子。
              </li>
              <li>
                取消 - 标记备份为已取消但不触发任何错误通知。跳过所有后续钩子。
              </li>
            </ul>
          </>
        }
      >
        错误行为：
      </Tooltip>
      <Form.Item name={[field.name, "onError"]}>
        <Select
          allowClear
          style={{ width: "100%" }}
          placeholder={"选择钩子失败时的响应..."}
          options={Hook_OnErrorSchema.values.map((v) => ({
            label: v.name,
            value: v.name,
          }))}
        />
      </Form.Item>
    </>
  );
};
const requiredField = (message: string, extra?: Rule) => ({
  required: true,
  message: message,
});
const HookConditionsTooltip = ({ children }: { children: React.ReactNode }) => {
  return (
    <Tooltip
      title={
        <div>
          可用条件
          <ul>
            <li>CONDITION_ANY_ERROR - 执行任何任务时出错</li>
            <li>CONDITION_SNAPSHOT_START - 备份操作开始</li>
            <li>
              CONDITION_SNAPSHOT_END - 备份操作结束（成功或失败）
            </li>
            <li>
              CONDITION_SNAPSHOT_SUCCESS - 备份成功结束
            </li>
            <li>CONDITION_SNAPSHOT_ERROR - 备份失败结束</li>
            <li>CONDITION_SNAPSHOT_WARNING - 部分备份结束</li>
            <li>CONDITION_PRUNE_START - 清理操作开始</li>
            <li>CONDITION_PRUNE_SUCCESS - 清理成功结束</li>
            <li>CONDITION_PRUNE_ERROR - 清理失败结束</li>
            <li>CONDITION_CHECK_START - 检查操作开始</li>
            <li>CONDITION_CHECK_SUCCESS - 检查成功结束</li>
            <li>CONDITION_CHECK_ERROR - 检查失败结束</li>
          </ul>
          更多信息请查阅{" "}
          <a
            href="https://garethgeorge.github.io/backrest/docs/hooks" 
            target="_blank"
          >
            文档
          </a>
        </div>
      }
    >
      {children}
    </Tooltip>
  );
};