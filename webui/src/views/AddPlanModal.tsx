import {
  Form,
  Modal,
  Input,
  Typography,
  Select,
  Button,
  Tooltip,
  Radio,
  InputNumber,
  Row,
  Col,
  Collapse,
  Checkbox,
} from "antd";
import React, { useEffect, useMemo, useState } from "react";
import { useShowModal } from "../components/ModalManager";
import {
  ConfigSchema,
  PlanSchema,
  RetentionPolicySchema,
  Schedule_Clock,
  type Plan,
} from "../../gen/ts/v1/config_pb";
import {
  CalculatorOutlined,
  MinusCircleOutlined,
  PlusOutlined,
} from "@ant-design/icons";
import { URIAutocomplete } from "../components/URIAutocomplete";
import { formatErrorAlert, useAlertApi } from "../components/Alerts";
import { namePattern, validateForm } from "../lib/formutil";
import {
  HooksFormList,
  hooksListTooltipText,
} from "../components/HooksFormList";
import { ConfirmButton, SpinButton } from "../components/SpinButton";
import { useConfig } from "../components/ConfigProvider";
import { backrestService } from "../api";
import {
  ScheduleDefaultsDaily,
  ScheduleFormItem,
} from "../components/ScheduleFormItem";
import { clone, create, equals, fromJson, toJson } from "@bufbuild/protobuf";
import { formatDuration } from "../lib/formatting";
import { getMinimumCronDuration } from "../lib/cronutil";

const planDefaults = create(PlanSchema, {
  schedule: {
    schedule: {
      case: "cron",
      value: "0 * * * *", // 每小时一次
    },
    clock: Schedule_Clock.LOCAL,
  },
  retention: {
    policy: {
      case: "policyTimeBucketed",
      value: {
        hourly: 24,
        daily: 30,
        monthly: 12,
      },
    },
  },
});

export const AddPlanModal = ({ template }: { template: Plan | null }) => {
  const [confirmLoading, setConfirmLoading] = useState(false);
  const showModal = useShowModal();
  const alertsApi = useAlertApi()!;
  const [config, setConfig] = useConfig();
  const [form] = Form.useForm();

  useEffect(() => {
    form.setFieldsValue(
      template
        ? toJson(PlanSchema, template, { alwaysEmitImplicit: true })
        : toJson(PlanSchema, planDefaults, { alwaysEmitImplicit: true })
    );
  }, [template]);

  if (!config) {
    return null;
  }

  const handleDestroy = async () => {
    setConfirmLoading(true);
    try {
      if (!template) {
        throw new Error("模板未找到");
      }
      const configCopy = clone(ConfigSchema, config);
      // 从配置中移除计划
      const idx = configCopy.plans.findIndex((r) => r.id === template.id);
      if (idx === -1) {
        throw new Error("更新配置失败，未找到要删除的计划");
      }
      configCopy.plans.splice(idx, 1);
      // 更新配置并通知成功
      setConfig(await backrestService.setConfig(configCopy));
      showModal(null);
      alertsApi.success(
        "计划已从配置中删除，但不会从 restic 存储库中删除。快照仍保留在存储中，操作记录将保留直到手动删除。如果已经执行过备份，不建议重复使用已删除的计划 ID。",
        30
      );
    } catch (e: any) {
      alertsApi.error(formatErrorAlert(e, "删除错误："), 15);
    } finally {
      setConfirmLoading(false);
    }
  };

  const handleOk = async () => {
    setConfirmLoading(true);
    try {
      let planFormData = await validateForm(form);
      const plan = fromJson(PlanSchema, planFormData, {
        ignoreUnknownFields: false,
      });

      if (
        plan.retention &&
        equals(
          RetentionPolicySchema,
          plan.retention,
          create(RetentionPolicySchema, {})
        )
      ) {
        delete plan.retention;
      }

      const configCopy = clone(ConfigSchema, config);

      // 将新计划合并（或更新）到配置中
      if (template) {
        const idx = configCopy.plans.findIndex((r) => r.id === template.id);
        if (idx === -1) {
          throw new Error("更新计划失败，未找到该计划");
        }
        configCopy.plans[idx] = plan;
      } else {
        configCopy.plans.push(plan);
      }

      // 更新配置并通知成功
      setConfig(await backrestService.setConfig(configCopy));
      showModal(null);
    } catch (e: any) {
      alertsApi.error(formatErrorAlert(e, "操作错误："), 15);
      console.error(e);
    } finally {
      setConfirmLoading(false);
    }
  };

  const handleCancel = () => {
    showModal(null);
  };

  const repos = config?.repos || [];

  return (
    <>
      <Modal
        open={true}
        onCancel={handleCancel}
        title={template ? "编辑计划" : "添加计划"}
        width="60vw"
        footer={[
          <Button loading={confirmLoading} key="back" onClick={handleCancel}>
            取消
          </Button>,
          template != null ? (
            <ConfirmButton
              key="delete"
              type="primary"
              danger
              onClickAsync={handleDestroy}
              confirmTitle="确认删除"
            >
              删除
            </ConfirmButton>
          ) : null,
          <SpinButton key="submit" type="primary" onClickAsync={handleOk}>
            提交
          </SpinButton>,
        ]}
        maskClosable={false}
      >
        <p>
          查看{" "}
          <a
            href="https://garethgeorge.github.io/backrest/introduction/getting-started" 
            target="_blank"
          >
            Backrest 入门指南
          </a>{" "}
          获取关于计划配置的说明。
        </p>
        <br />
        <Form
          autoComplete="off"
          form={form}
          labelCol={{ span: 6 }}
          wrapperCol={{ span: 16 }}
          disabled={confirmLoading}
        >
          {/* Plan.id */}
          <Tooltip title="用于标识此计划在 Backrest 中的唯一 ID（例如 s3-myplan）。创建后无法更改">
            <Form.Item<Plan>
              hasFeedback
              name="id"
              label="计划名称"
              initialValue={template ? template.id : ""}
              validateTrigger={["onChange", "onBlur"]}
              rules={[
                {
                  required: true,
                  message: "请输入计划名称",
                },
                {
                  validator: async (_, value) => {
                    if (template) return;
                    if (config?.plans?.find((r) => r.id === value)) {
                      throw new Error("已存在相同名称的计划");
                    }
                  },
                  message: "已存在相同名称的计划",
                },
                {
                  pattern: namePattern,
                  message:
                    "名称必须为字母数字组合，允许使用横线或下划线作为分隔符",
                },
              ]}
            >
              <Input
                placeholder={"plan" + ((config?.plans?.length || 0) + 1)}
                disabled={!!template}
              />
            </Form.Item>
          </Tooltip>

          {/* Plan.repo */}
          <Tooltip title="Backrest 会将快照存储在此仓库中">
            <Form.Item<Plan>
              name="repo"
              label="仓库"
              validateTrigger={["onChange", "onBlur"]}
              initialValue={template ? template.repo : ""}
              rules={[
                {
                  required: true,
                  message: "请选择一个仓库",
                },
              ]}
            >
              <Select
                options={repos.map((repo) => ({
                  value: repo.id,
                }))}
                disabled={!!template}
              />
            </Form.Item>
          </Tooltip>

          {/* Plan.paths */}
          <Form.Item label="路径" required={true}>
            <Form.List
              name="paths"
              rules={[]}
              initialValue={template ? template.paths : []}
            >
              {(fields, { add, remove }, { errors }) => (
                <>
                  {fields.map((field, index) => (
                    <Form.Item key={field.key}>
                      <Form.Item
                        {...field}
                        validateTrigger={["onChange", "onBlur"]}
                        initialValue={""}
                        rules={[
                          {
                            required: true,
                          },
                        ]}
                        noStyle
                      >
                        <URIAutocomplete
                          style={{ width: "90%" }}
                          onBlur={() => form.validateFields()}
                        />
                      </Form.Item>
                      <MinusCircleOutlined
                        className="dynamic-delete-button"
                        onClick={() => remove(field.name)}
                        style={{ paddingLeft: "5px" }}
                      />
                    </Form.Item>
                  ))}
                  <Form.Item>
                    <Button
                      type="dashed"
                      onClick={() => add()}
                      style={{ width: "90%" }}
                      icon={<PlusOutlined />}
                    >
                      添加路径
                    </Button>
                    <Form.ErrorList errors={errors} />
                  </Form.Item>
                </>
              )}
            </Form.List>
          </Form.Item>

          {/* Plan.excludes */}
          <Tooltip
            title={
              <>
                要排除的备份路径。更多信息请参考{" "}
                <a
                  href="https://restic.readthedocs.io/en/latest/040_backup.html#excluding-files" 
                  target="_blank"
                >
                  restic 官方文档
                </a>
              </>
            }
          >
            <Form.Item label="排除路径" required={false}>
              <Form.List
                name="excludes"
                rules={[]}
                initialValue={template ? template.excludes : []}
              >
                {(fields, { add, remove }, { errors }) => (
                  <>
                    {fields.map((field, index) => (
                      <Form.Item required={false} key={field.key}>
                        <Form.Item
                          {...field}
                          validateTrigger={["onChange", "onBlur"]}
                          initialValue={""}
                          rules={[
                            {
                              required: true,
                            },
                          ]}
                          noStyle
                        >
                          <URIAutocomplete
                            style={{ width: "90%" }}
                            onBlur={() => form.validateFields()}
                            globAllowed={true}
                          />
                        </Form.Item>
                        <MinusCircleOutlined
                          className="dynamic-delete-button"
                          onClick={() => remove(field.name)}
                          style={{ paddingLeft: "5px" }}
                        />
                      </Form.Item>
                    ))}
                    <Form.Item>
                      <Button
                        type="dashed"
                        onClick={() => add()}
                        style={{ width: "90%" }}
                        icon={<PlusOutlined />}
                      >
                        添加排除规则（区分大小写）
                      </Button>
                      <Form.ErrorList errors={errors} />
                    </Form.Item>
                  </>
                )}
              </Form.List>
            </Form.Item>
          </Tooltip>

          {/* Plan.iexcludes */}
          <Tooltip
            title={
              <>
                不区分大小写的排除路径。更多信息请参考{" "}
                <a
                  href="https://restic.readthedocs.io/en/latest/040_backup.html#excluding-files" 
                  target="_blank"
                >
                  restic 官方文档
                </a>
              </>
            }
          >
            <Form.Item label="排除路径（不区分大小写）" required={false}>
              <Form.List
                name="iexcludes"
                rules={[]}
                initialValue={template ? template.iexcludes : []}
              >
                {(fields, { add, remove }, { errors }) => (
                  <>
                    {fields.map((field, index) => (
                      <Form.Item required={false} key={field.key}>
                        <Form.Item
                          {...field}
                          validateTrigger={["onChange", "onBlur"]}
                          initialValue={""}
                          rules={[
                            {
                              required: true,
                            },
                          ]}
                          noStyle
                        >
                          <URIAutocomplete
                            style={{ width: "90%" }}
                            onBlur={() => form.validateFields()}
                            globAllowed={true}
                          />
                        </Form.Item>
                        <MinusCircleOutlined
                          className="dynamic-delete-button"
                          onClick={() => remove(field.name)}
                          style={{ paddingLeft: "5px" }}
                        />
                      </Form.Item>
                    ))}
                    <Form.Item>
                      <Button
                        type="dashed"
                        onClick={() => add()}
                        style={{ width: "90%" }}
                        icon={<PlusOutlined />}
                      >
                        添加不区分大小写的排除规则
                      </Button>
                      <Form.ErrorList errors={errors} />
                    </Form.Item>
                  </>
                )}
              </Form.List>
            </Form.Item>
          </Tooltip>

          {/* Plan.cron */}
          <Form.Item label="备份时间表">
            <ScheduleFormItem
              name={["schedule"]}
              defaults={ScheduleDefaultsDaily}
            />
          </Form.Item>

          {/* Plan.backup_flags */}
          <Form.Item
            label={
              <Tooltip title="额外参数，将被添加到 'restic backup' 命令中">
                备份参数
              </Tooltip>
            }
          >
            <Form.List name="backup_flags">
              {(fields, { add, remove }, { errors }) => (
                <>
                  {fields.map((field, index) => (
                    <Form.Item required={false} key={field.key}>
                      <Form.Item
                        {...field}
                        validateTrigger={["onChange", "onBlur"]}
                        rules={[
                          {
                            required: true,
                            whitespace: true,
                            pattern: /^\-\-?.*$/,
                            message:
                              "参数应为 CLI 格式，如 --flag",
                          },
                        ]}
                        noStyle
                      >
                        <Input placeholder="--flag" style={{ width: "90%" }} />
                      </Form.Item>
                      <MinusCircleOutlined
                        className="dynamic-delete-button"
                        onClick={() => remove(index)}
                        style={{ paddingLeft: "5px" }}
                      />
                    </Form.Item>
                  ))}
                  <Form.Item>
                    <Button
                      type="dashed"
                      onClick={() => add()}
                      style={{ width: "90%" }}
                      icon={<PlusOutlined />}
                    >
                      设置参数
                    </Button>
                    <Form.ErrorList errors={errors} />
                  </Form.Item>
                </>
              )}
            </Form.List>
          </Form.Item>

          {/* Plan.retention */}
          <RetentionPolicyView />

          {/* Plan.hooks */}
          <Form.Item
            label={<Tooltip title={hooksListTooltipText}>钩子</Tooltip>}
          >
            <HooksFormList />
          </Form.Item>

          <Form.Item shouldUpdate label="预览">
            {() => (
              <Collapse
                size="small"
                items={[
                  {
                    key: "1",
                    label: "计划配置 JSON 格式",
                    children: (
                      <Typography>
                        <pre>
                          {JSON.stringify(form.getFieldsValue(), null, 2)}
                        </pre>
                      </Typography>
                    ),
                  },
                ]}
              />
            )}
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
};

const RetentionPolicyView = () => {
  const form = Form.useFormInstance();
  const schedule = Form.useWatch("schedule", { form }) as any;
  const retention = Form.useWatch("retention", { form, preserve: true }) as any;

  const cronIsSubHourly = useMemo(
    () => schedule?.cron && !/^\d+ /.test(schedule.cron),
    [schedule?.cron]
  );

  const minRetention = useMemo(() => {
    const keepLastN = retention?.policyTimeBucketed?.keepLastN;
    if (!keepLastN) {
      return null;
    }
    const msPerHour = 60 * 60 * 1000;
    const msPerDay = 24 * msPerHour;
    let duration = 0;
    if (schedule?.maxFrequencyHours) {
      duration = schedule.maxFrequencyHours * (keepLastN - 1) * msPerHour;
    } else if (schedule?.maxFrequencyDays) {
      duration = schedule.maxFrequencyDays * (keepLastN - 1) * msPerDay;
    } else if (schedule?.cron && retention.policyTimeBucketed?.keepLastN) {
      duration = getMinimumCronDuration(
        schedule.cron,
        retention.policyTimeBucketed?.keepLastN
      );
    }
    return duration ? formatDuration(duration, { minUnit: "h" }) : null;
  }, [schedule, retention?.policyTimeBucketed?.keepLastN]);

  const determineMode = () => {
    if (!retention) {
      return "policyTimeBucketed";
    } else if (retention.policyKeepLastN) {
      return "policyKeepLastN";
    } else if (retention.policyKeepAll) {
      return "policyKeepAll";
    } else if (retention.policyTimeBucketed) {
      return "policyTimeBucketed";
    }
  };

  const mode = determineMode();
  let elem: React.ReactNode = null;

  if (mode === "policyKeepAll") {
    elem = (
      <>
        <p>
          所有备份都会被保留（例如用于只追加的仓库）。请确保手动清理 / 清理旧的备份。
          Backrest 将在下次备份时识别外部执行的 forget 操作。
        </p>
        <Form.Item
          name={["retention", "policyKeepAll"]}
          valuePropName="checked"
          initialValue={true}
          hidden={true}
        >
          <Checkbox />
        </Form.Item>
      </>
    );
  } else if (mode === "policyKeepLastN") {
    elem = (
      <Form.Item
        name={["retention", "policyKeepLastN"]}
        initialValue={0}
        validateTrigger={["onChange", "onBlur"]}
        rules={[
          {
            required: true,
            message: "请输入保留最近 N 个备份",
          },
        ]}
      >
        <InputNumber
          addonBefore={<div style={{ width: "5em" }}>数量</div>}
          type="number"
        />
      </Form.Item>
    );
  } else if (mode === "policyTimeBucketed") {
    elem = (
      <>
        <Row>
          <Col span={11}>
            <Form.Item
              name={["retention", "policyTimeBucketed", "yearly"]}
              validateTrigger={["onChange", "onBlur"]}
              initialValue={0}
              required={false}
            >
              <InputNumber
                addonBefore={<div style={{ width: "5em" }}>每年</div>}
                type="number"
              />
            </Form.Item>
            <Form.Item
              name={["retention", "policyTimeBucketed", "monthly"]}
              initialValue={0}
              validateTrigger={["onChange", "onBlur"]}
              required={false}
            >
              <InputNumber
                addonBefore={<div style={{ width: "5em" }}>每月</div>}
                type="number"
              />
            </Form.Item>
            <Form.Item
              name={["retention", "policyTimeBucketed", "weekly"]}
              initialValue={0}
              validateTrigger={["onChange", "onBlur"]}
              required={false}
            >
              <InputNumber
                addonBefore={<div style={{ width: "5em" }}>每周</div>}
                type="number"
              />
            </Form.Item>
          </Col>
          <Col span={11} offset={1}>
            <Form.Item
              name={["retention", "policyTimeBucketed", "daily"]}
              validateTrigger={["onChange", "onBlur"]}
              initialValue={0}
              required={false}
            >
              <InputNumber
                addonBefore={<div style={{ width: "5em" }}>每天</div>}
                type="number"
              />
            </Form.Item>
            <Form.Item
              name={["retention", "policyTimeBucketed", "hourly"]}
              validateTrigger={["onChange", "onBlur"]}
              initialValue={0}
              required={false}
            >
              <InputNumber
                addonBefore={<div style={{ width: "5em" }}>每小时</div>}
                type="number"
              />
            </Form.Item>
          </Col>
        </Row>
        <Form.Item
          name={["retention", "policyTimeBucketed", "keepLastN"]}
          label="始终保留最近 N 个快照"
          validateTrigger={["onChange", "onBlur"]}
          initialValue={0}
          required={cronIsSubHourly}
          rules={[
            {
              validator: async (_, value) => {
                if (cronIsSubHourly && !(value > 1)) {
                  throw new Error("请输入大于 1 的数字");
                }
              },
              message:
                "您的计划每小时运行多次，请指定要保留的快照数量，以便应用保留策略。",
            },
          ]}
        >
          <InputNumber
            type="number"
            min={0}
            addonAfter={
              <Tooltip
                title={
                  minRetention
                    ? `${retention?.policyTimeBucketed?.keepLastN} 个快照预计保留至少 ${minRetention}`
                    : "选择保留的快照数量，并通过计算器查看对应的最小保留时间"
                }
              >
                <CalculatorOutlined
                  style={{
                    padding: ".5em",
                    margin: "0 -.5em",
                  }}
                />
              </Tooltip>
            }
          />
        </Form.Item>
      </>
    );
  }

  return (
    <>
      <Form.Item label="保留策略">
        <Row>
          <Radio.Group
            value={mode}
            onChange={(e) => {
              const selected = e.target.value;
              if (selected === "policyKeepLastN") {
                form.setFieldValue("retention", { policyKeepLastN: 30 });
              } else if (selected === "policyTimeBucketed") {
                form.setFieldValue("retention", {
                  policyTimeBucketed: {
                    yearly: 0,
                    monthly: 3,
                    weekly: 4,
                    daily: 7,
                    hourly: 24,
                  },
                });
              } else {
                form.setFieldValue("retention", { policyKeepAll: true });
              }
            }}
          >
            <Radio.Button value={"policyKeepLastN"}>
              <Tooltip title="保留最后 N 个快照。每次备份后应用此策略">
                按数量
              </Tooltip>
            </Radio.Button>
            <Radio.Button value={"policyTimeBucketed"}>
              <Tooltip title="保留特定时间段内的快照。每次备份后应用此策略">
                按时间周期
              </Tooltip>
            </Radio.Button>
            <Radio.Button value={"policyKeepAll"}>
              <Tooltip title="所有备份都将保留。注意：如果快照数量很大，可能会导致备份变慢">
                不设置
              </Tooltip>
            </Radio.Button>
          </Radio.Group>
        </Row>
        <br />
        <Row>
          <Form.Item>{elem}</Form.Item>
        </Row>
      </Form.Item>
    </>
  );
};