import {
  Checkbox,
  Form,
  InputNumber,
  Radio,
  Row,
  Tooltip,
  Typography,
} from "antd";
import React from "react";
import Cron, { CronType, PeriodType } from "react-js-cron";
import {
  Schedule_Clock,
  Schedule_ClockSchema,
} from "../../gen/ts/v1/config_pb";

interface ScheduleDefaults {
  maxFrequencyDays: number;
  maxFrequencyHours: number;
  cron: string;
  cronPeriods?: PeriodType[];
  cronDropdowns?: CronType[];
  clock: Schedule_Clock;
}

export const ScheduleDefaultsInfrequent: ScheduleDefaults = {
  maxFrequencyDays: 30,
  maxFrequencyHours: 30 * 24,
  // 每月第一天的午夜
  cron: "0 0 1 * *",
  cronDropdowns: ["period", "months", "month-days", "week-days", "hours"],
  cronPeriods: ["month", "week"],
  clock: Schedule_Clock.LAST_RUN_TIME,
};

export const ScheduleDefaultsDaily: ScheduleDefaults = {
  maxFrequencyDays: 1,
  maxFrequencyHours: 24,
  // 每天午夜
  cron: "0 0 * * *",
  cronDropdowns: [
    "period",
    "months",
    "month-days",
    "hours",
    "minutes",
    "week-days",
  ],
  cronPeriods: ["day", "hour", "month", "week"],
  clock: Schedule_Clock.LOCAL,
};

type SchedulingMode =
  | ""
  | "disabled"
  | "maxFrequencyDays"
  | "maxFrequencyHours"
  | "cron";

export const ScheduleFormItem = ({
  name,
  defaults,
}: {
  name: string[];
  defaults: ScheduleDefaults;
}) => {
  const form = Form.useFormInstance();
  const schedule = Form.useWatch(name, { form, preserve: true }) as any;

  if (schedule !== undefined && schedule.clock === undefined) {
    form.setFieldValue(
      name.concat("clock"),
      clockEnumValueToString(defaults.clock)
    );
  }

  const determineMode = (): SchedulingMode => {
    if (!schedule) {
      return "";
    } else if (schedule.disabled) {
      return "disabled";
    } else if (schedule.maxFrequencyDays) {
      return "maxFrequencyDays";
    } else if (schedule.maxFrequencyHours) {
      return "maxFrequencyHours";
    } else if (schedule.cron) {
      return "cron";
    }
    return "";
  };

  const mode = determineMode();

  let elem: React.ReactNode = null;
  if (mode === "cron") {
    elem = (
      <Form.Item
        name={name.concat(["cron"])}
        initialValue={defaults.cron}
        validateTrigger={["onChange", "onBlur"]}
        rules={[
          {
            required: true,
            message: "请输入有效的Cron表达式。",
          },
        ]}
      >
        <Cron
          value={form.getFieldValue(name.concat(["cron"]))}
          setValue={(val: string) => {
            form.setFieldValue(name.concat(["cron"]), val);
          }}
          allowedDropdowns={defaults.cronDropdowns}
          allowedPeriods={defaults.cronPeriods}
          clearButton={false}
        />
      </Form.Item>
    );
  } else if (mode === "maxFrequencyDays") {
    elem = (
      <Form.Item
        name={name.concat(["maxFrequencyDays"])}
        initialValue={defaults.maxFrequencyDays}
        validateTrigger={["onChange", "onBlur"]}
        rules={[
          {
            required: true,
            message: "请输入间隔天数",
          },
        ]}
      >
        <InputNumber
          addonBefore={<div style={{ width: "10em" }}>间隔天数</div>}
          type="number"
          min={1}
        />
      </Form.Item>
    );
  } else if (mode === "maxFrequencyHours") {
    elem = (
      <Form.Item
        name={name.concat(["maxFrequencyHours"])}
        initialValue={defaults.maxFrequencyHours}
        validateTrigger={["onChange", "onBlur"]}
        rules={[
          {
            required: true,
            message: "请输入间隔小时数",
          },
        ]}
      >
        <InputNumber
          addonBefore={<div style={{ width: "10em" }}>间隔小时数</div>}
          type="number"
          min={1}
        />
      </Form.Item>
    );
  } else if (mode === "disabled") {
    elem = (
      <Form.Item
        name={name.concat(["disabled"])}
        valuePropName="checked"
        initialValue={true}
        hidden={true}
      >
        <Checkbox />
      </Form.Item>
    );
  }

  return (
    <>
      <Row>
        <Radio.Group
          value={mode}
          onChange={(e) => {
            const selected = e.target.value;
            if (selected === "maxFrequencyDays") {
              form.setFieldValue(name, {
                maxFrequencyDays: defaults!.maxFrequencyDays,
              });
            } else if (selected === "maxFrequencyHours") {
              form.setFieldValue(name, {
                maxFrequencyHours: defaults!.maxFrequencyHours,
              });
            } else if (selected === "cron") {
              form.setFieldValue(name, { cron: defaults!.cron });
            } else if (selected === "minHoursSinceLastRun") {
              form.setFieldValue(name, { minHoursSinceLastRun: 1 });
            } else if (selected === "minDaysSinceLastRun") {
              form.setFieldValue(name, { minDaysSinceLastRun: 1 });
            } else if (selected === "cronSinceLastRun") {
              form.setFieldValue(name, { cronSinceLastRun: defaults!.cron });
            } else {
              form.setFieldValue(name, { disabled: true });
            }
          }}
        >
          <Radio.Button value={"disabled"}>
            <Tooltip title="计划已禁用，将永远不会运行。">
              禁用
            </Tooltip>
          </Radio.Button>
          <Radio.Button value={"maxFrequencyHours"}>
            <Tooltip title="计划将按照指定的小时间隔运行。">
              小时间隔
            </Tooltip>
          </Radio.Button>
          <Radio.Button value={"maxFrequencyDays"}>
            <Tooltip title="计划将按照指定的天数间隔运行。">
              天数间隔
            </Tooltip>
          </Radio.Button>
          <Radio.Button value={"cron"}>
            <Tooltip title="计划将根据Cron表达式运行。">
              Cron表达式
            </Tooltip>
          </Radio.Button>
        </Radio.Group>
        <Typography.Text style={{ marginLeft: "1em", marginRight: "1em" }}>
          计划时钟：
        </Typography.Text>
        <Tooltip
          title={
            <>
              时钟提供计划评估的参考时间：
              <ul>
                <li>本地 - 当前本地时区的时间。</li>
                <li>UTC - 当前协调世界时。</li>
                <li>
                  上次运行时间 - 相对于任务上次运行的时间。适合不总是开机的设备（如笔记本电脑）。
                </li>
              </ul>
            </>
          }
        >
          <Form.Item name={name.concat("clock")}>
            <Radio.Group>
              <Radio.Button
                value={clockEnumValueToString(Schedule_Clock.LOCAL)}
              >
                本地
              </Radio.Button>
              <Radio.Button
                value={clockEnumValueToString(Schedule_Clock.UTC)}
              >
                UTC
              </Radio.Button>
              <Radio.Button
                value={clockEnumValueToString(Schedule_Clock.LAST_RUN_TIME)}
              >
                上次运行时间
              </Radio.Button>
            </Radio.Group>
          </Form.Item>
        </Tooltip>
      </Row>
      <div style={{ height: "0.5em" }} />
      <Row>
        <Form.Item>{elem}</Form.Item>
      </Row>
    </>
  );
};

const clockEnumValueToString = (clock: Schedule_Clock) =>
  Schedule_ClockSchema.values.find((v) => v.number === clock)?.name;