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

// 默认计划配置
const planDefaults = create(PlanSchema, {
  schedule: {
    schedule: {
      case: "cron",
      value: "0 * * * *", // 每小时执行
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
  const [确认加载, 设置确认加载] = useState(false);
  const 显示模态框 = useShowModal();
  const 提示框服务 = useAlertApi()!;
  const [配置, 设置配置] = useConfig();
  const [表单] = Form.useForm();

  useEffect(() => {
    表单.setFieldsValue(
      template
        ? toJson(PlanSchema, template, { alwaysEmitImplicit: true })
        : toJson(PlanSchema, planDefaults, { alwaysEmitImplicit: true })
    );
  }, [template]);

  if (!配置) {
    return null;
  }

  // 删除计划处理
  const 处理删除 = async () => {
    设置确认加载(true);
    try {
      if (!模板) {
        throw new Error("模板未找到");
      }
      const 配置副本 = clone(ConfigSchema, 配置);
      // 从配置中移除计划
      const 索引 = 配置副本.plans.findIndex((r) => r.id === 模板.id);
      if (索引 === -1) {
        throw new Error("更新配置失败，未找到要删除的计划");
      }
      配置副本.plans.splice(索引, 1);
      // 更新配置并提示成功
      设置配置(await backrestService.setConfig(配置副本));
      显示模态框(null);
      提示框服务.success(
        "计划已从配置中删除，但不会从restic仓库中删除。快照将保留在存储中，操作记录会保留直到手动删除。如果已执行过备份，不建议重复使用已删除的计划ID。",
        30
      );
    } catch (错误: any) {
      提示框服务.error(formatErrorAlert(错误, "删除错误："), 15);
    } finally {
      设置确认加载(false);
    }
  };

  // 提交处理
  const 处理提交 = async () => {
    设置确认加载(true);
    try {
      let 表单数据 = await validateForm(表单);
      const 计划 = fromJson(PlanSchema, 表单数据, {
        ignoreUnknownFields: false,
      });
      
      if (
        计划.retention &&
        equals(
          RetentionPolicySchema,
          计划.retention,
          create(RetentionPolicySchema, {})
        )
      ) {
        delete 计划.retention;
      }

      const 配置副本 = clone(ConfigSchema, 配置);

      // 合并新计划到配置
      if (模板) {
        const 索引 = 配置副本.plans.findIndex((r) => r.id === 模板.id);
        if (索引 === -1) {
          throw new Error("更新计划失败，未找到");
        }
        配置副本.plans[索引] = 计划;
      } else {
        配置副本.plans.push(计划);
      }

      // 更新配置并提示成功
      设置配置(await backrestService.setConfig(配置副本));
      显示模态框(null);
    } catch (错误: any) {
      提示框服务.error(formatErrorAlert(错误, "操作错误："), 15);
      console.error(错误);
    } finally {
      设置确认加载(false);
    }
  };

  const 处理取消 = () => {
    显示模态框(null);
  };

  const 仓库列表 = 配置?.repos || [];

  return (
    <>
      <Modal
        open={true}
        onCancel={处理取消}
        title={模板 ? "编辑计划" : "添加计划"}
        width="60vw"
        footer={[
          <Button loading={确认加载} key="back" onClick={处理取消}>
            取消
          </Button>,
          模板 != null ? (
            <ConfirmButton
              key="delete"
              type="primary"
              danger
              onClickAsync={处理删除}
              confirmTitle="确认删除"
            >
              删除
            </ConfirmButton>
          ) : null,
          <SpinButton key="submit" type="primary" onClickAsync={处理提交}>
            提交
          </SpinButton>,
        ]}
        maskClosable={false}
      >
        <p>
          请参考{" "}
          <a
            href="https://garethgeorge.github.io/backrest/introduction/getting-started" 
            target="_blank"
          >
            Backrest入门指南
          </a>{" "}
          获取计划配置说明。
        </p>
        <br />
        <Form
          autoComplete="off"
          form={表单}
          labelCol={{ span: 6 }}
          wrapperCol={{ span: 16 }}
          disabled={确认加载}
        >
          {/* 计划名称 */}
          <Tooltip title="用于标识此计划的唯一ID（例如s3-myplan）。创建后不可修改">
            <Form.Item<Plan>
              hasFeedback
              name="id"
              label="计划名称"
              initialValue={模板 ? 模板.id : ""}
              validateTrigger={["onChange", "onBlur"]}
              rules={[
                {
                  required: true,
                  message: "请输入计划名称",
                },
                {
                  validator: async (_, 值) => {
                    if (模板) return;
                    if (配置?.plans?.find((计划) => 计划.id === 值)) {
                      throw new Error("该计划名称已存在");
                    }
                  },
                  message: "该计划名称已存在",
                },
                {
                  pattern: namePattern,
                  message:
                    "名称必须为字母数字，允许使用短横线或下划线作为分隔符",
                },
              ]}
            >
              <Input
                placeholder={"plan" + ((配置?.plans?.length || 0) + 1)}
                disabled={!!模板}
              />
            </Form.Item>
          </Tooltip>

          {/* 关联仓库 */}
          <Tooltip title="Backrest将把快照存储在此仓库中">
            <Form.Item<Plan>
              name="repo"
              label="仓库"
              validateTrigger={["onChange", "onBlur"]}
              initialValue={模板 ? 模板.repo : ""}
              rules={[
                {
                  required: true,
                  message: "请选择仓库",
                },
              ]}
            >
              <Select
                options={仓库列表.map((仓库) => ({
                  value: 仓库.id,
                }))}
                disabled={!!模板}
              />
            </Form.Item>
          </Tooltip>

          {/* 备份路径 */}
          <Form.Item label="备份路径" required={true}>
            <Form.List
              name="paths"
              rules={[]}
              initialValue={模板 ? 模板.paths : []}
            >
              {(字段, { add, remove }, { errors }) => (
                <>
                  {字段.map((字段, 索引) => (
                    <Form.Item key={字段.key}>
                      <Form.Item
                        {...字段}
                        validateTrigger={["onChange", "onBlur"]}
                        initialValue={""}
                        rules={[{ required: true }]}
                        noStyle
                      >
                        <URIAutocomplete
                          style={{ width: "90%" }}
                          onBlur={() => 表单.validateFields()}
                        />
                      </Form.Item>
                      <MinusCircleOutlined
                        className="dynamic-delete-button"
                        onClick={() => remove(字段.name)}
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
                      添加备份路径
                    </Button>
                    <Form.ErrorList errors={errors} />
                  </Form.Item>
                </>
              )}
            </Form.List>
          </Form.Item>

          {/* 排除路径 */}
          <Tooltip
            title={
              <>
                要排除的备份路径。请参考{" "}
                <a
                  href="https://restic.readthedocs.io/en/latest/040_backup.html#excluding-files" 
                  target="_blank"
                >
                  restic文档
                </a>{" "}
                获取更多信息。
              </>
            }
          >
            <Form.Item label="排除路径" required={false}>
              <Form.List
                name="excludes"
                rules={[]}
                initialValue={模板 ? 模板.excludes : []}
              >
                {(字段, { add, remove }, { errors }) => (
                  <>
                    {字段.map((字段, 索引) => (
                      <Form.Item required={false} key={字段.key}>
                        <Form.Item
                          {...字段}
                          validateTrigger={["onChange", "onBlur"]}
                          initialValue={""}
                          rules={[{ required: true }]}
                          noStyle
                        >
                          <URIAutocomplete
                            style={{ width: "90%" }}
                            onBlur={() => 表单.validateFields()}
                            globAllowed={true}
                          />
                        </Form.Item>
                        <MinusCircleOutlined
                          className="dynamic-delete-button"
                          onClick={() => remove(字段.name)}
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
                        添加排除模式
                      </Button>
                      <Form.ErrorList errors={errors} />
                    </Form.Item>
                  </>
                )}
              </Form.List>
            </Form.Item>
          </Tooltip>

          {/* 不区分大小写排除路径 */}
          <Tooltip
            title={
              <>
                不区分大小写的排除路径。请参考{" "}
                <a
                  href="https://restic.readthedocs.io/en/latest/040_backup.html#excluding-files" 
                  target="_blank"
                >
                  restic文档
                </a>{" "}
                获取更多信息。
              </>
            }
          >
            <Form.Item label="排除路径（不区分大小写）" required={false}>
              <Form.List
                name="iexcludes"
                rules={[]}
                initialValue={模板 ? 模板.iexcludes : []}
              >
                {(字段, { add, remove }, { errors }) => (
                  <>
                    {字段.map((字段, 索引) => (
                      <Form.Item required={false} key={字段.key}>
                        <Form.Item
                          {...字段}
                          validateTrigger={["onChange", "onBlur"]}
                          initialValue={""}
                          rules={[{ required: true }]}
                          noStyle
                        >
                          <URIAutocomplete
                            style={{ width: "90%" }}
                            onBlur={() => 表单.validateFields()}
                            globAllowed={true}
                          />
                        </Form.Item>
                        <MinusCircleOutlined
                          className="dynamic-delete-button"
                          onClick={() => remove(字段.name)}
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
                        添加不区分大小写排除模式
                      </Button>
                      <Form.ErrorList errors={errors} />
                    </Form.Item>
                  </>
                )}
              </Form.List>
            </Form.Item>
          </Tooltip>

          {/* 备份计划 */}
          <Form.Item label="备份计划">
            <ScheduleFormItem
              name={["schedule"]}
              defaults={ScheduleDefaultsDaily}
            />
          </Form.Item>

          {/* 备份标志 */}
          <Form.Item
            label={
              <Tooltip title="添加额外参数到'restic backup'命令">
                备份参数
              </Tooltip>
            }
          >
            <Form.List name="backup_flags">
              {(字段, { add, remove }, { errors }) => (
                <>
                  {字段.map((字段, 索引) => (
                    <Form.Item required={false} key={字段.key}>
                      <Form.Item
                        {...字段}
                        validateTrigger={["onChange", "onBlur"]}
                        rules={[
                          {
                            required: true,
                            whitespace: true,
                            pattern: /^\-\-?.*$/,
                            message:
                              "请输入CLI参数（参考restic backup --help）",
                          },
                        ]}
                        noStyle
                      >
                        <Input placeholder="--flag" style={{ width: "90%" }} />
                      </Form.Item>
                      <MinusCircleOutlined
                        className="dynamic-delete-button"
                        onClick={() => remove(索引)}
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

          {/* 保留策略 */}
          <保留策略视图 />

          {/* 钩子配置 */}
          <Form.Item
            label={<Tooltip title={hooksListTooltipText}>钩子</Tooltip>}
          >
            <HooksFormList />
          </Form.Item>

          {/* JSON预览 */}
          <Form.Item shouldUpdate label="预览">
            {() => (
              <Collapse
                size="small"
                items={[
                  {
                    key: "1",
                    label: "计划配置JSON格式",
                    children: (
                      <Typography>
                        <pre>
                          {JSON.stringify(表单.getFieldsValue(), null, 2)}
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

// 保留策略视图组件
const 保留策略视图 = () => {
  const 表单 = Form.useFormInstance();
  const 计划 = Form.useWatch("schedule", { form }) as any;
  const 保留策略 = Form.useWatch("retention", { form, preserve: true }) as any;

  // 判断是否为每小时多次执行
  const cronIsSubHourly = useMemo(
    () => 计划?.cron && !/^\d+ /.test(计划.cron),
    [计划?.cron]
  );

  // 计算最小保留时长
  const 最小保留时长 = useMemo(() => {
    const keepLastN = 保留策略?.policyTimeBucketed?.keepLastN;
    if (!keepLastN) {
      return null;
    }
    const msPerHour = 60 * 60 * 1000;
    const msPerDay = 24 * msPerHour;
    let duration = 0;

    if (计划?.maxFrequencyHours) {
      duration = 计划.maxFrequencyHours * (keepLastN - 1) * msPerHour;
    } else if (计划?.maxFrequencyDays) {
      duration = 计划.maxFrequencyDays * (keepLastN - 1) * msPerDay;
    } else if (计划?.cron && 保留策略.policyTimeBucketed?.keepLastN) {
      duration = getMinimumCronDuration(
        计划.cron,
        保留策略.policyTimeBucketed?.keepLastN
      );
    }
    return duration ? formatDuration(duration, { minUnit: "h" }) : null;
  }, [计划, 保留策略?.policyTimeBucketed?.keepLastN]);

  // 确定保留策略模式
  const 确定模式 = () => {
    if (!保留策略) {
      return "policyTimeBucketed";
    } else if (保留策略.policyKeepLastN) {
      return "policyKeepLastN";
    } else if (保留策略.policyKeepAll) {
      return "policyKeepAll";
    } else if (保留策略.policyTimeBucketed) {
      return "policyTimeBucketed";
    }
  };

  const 当前模式 = 确定模式();

  // 不同保留策略的UI组件
  let 内容: React.ReactNode = null;

  // 保留全部
  if (当前模式 === "policyKeepAll") {
    内容 = (
      <>
        <p>
          所有备份都会被保留（例如用于只追加的仓库）。请确保手动执行forget/prune操作。
          Backrest会在下次备份时识别外部执行的forget操作。
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
  } 
  // 按数量保留
  else if (当前模式 === "policyKeepLastN") {
    内容 = (
      <Form.Item
        name={["retention", "policyKeepLastN"]}
        initialValue={0}
        validateTrigger={["onChange", "onBlur"]}
        rules={[
          {
            required: true,
            message: "请输入保留数量",
          },
        ]}
      >
        <InputNumber
          addonBefore={<div style={{ width: "5em" }}>保留数量</div>}
          type="number"
        />
      </Form.Item>
    );
  } 
  // 按时间范围保留
  else if (当前模式 === "policyTimeBucketed") {
    内容 = (
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
                addonBefore={<div style={{ width: "5em" }}>每日</div>}
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
          label="始终保留的最新快照数量"
          validateTrigger={["onChange", "onBlur"]}
          initialValue={0}
          required={cronIsSubHourly}
          rules={[
            {
              validator: async (_, 值) => {
                if (cronIsSubHourly && !(值 > 1)) {
                  throw new Error("请输入大于1的数字");
                }
              },
              message:
                "您的计划每小时执行多次，请指定要保留的快照数量（需大于1）",
            },
          ]}
        >
          <InputNumber
            type="number"
            min={0}
            addonAfter={
              <Tooltip
                title={
                  最小保留时长
                    ? `保留${保留策略?.policyTimeBucketed?.keepLastN}个快照的预计时长至少为${最小保留时长}，实际可能因手动备份或间歇性在线而更长`
                    : "输入保留数量后，计算器会显示预计的保留时长"
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
            value={当前模式}
            onChange={(e) => {
              const 选中模式 = e.target.value;
              if (选中模式 === "policyKeepLastN") {
                表单.setFieldValue("retention", { policyKeepLastN: 30 });
              } else if (选中模式 === "policyTimeBucketed") {
                表单.setFieldValue("retention", {
                  policyTimeBucketed: {
                    yearly: 0,
                    monthly: 3,
                    weekly: 4,
                    daily: 7,
                    hourly: 24,
                  },
                });
              } else {
                表单.setFieldValue("retention", { policyKeepAll: true });
              }
            }}
          >
            <Radio.Button value={"policyKeepLastN"}>
              <Tooltip title="保留最近N个快照，旧快照将在每次备份后删除">
                按数量
              </Tooltip>
            </Radio.Button>
            <Radio.Button value={"policyTimeBucketed"}>
              <Tooltip title="按时间范围保留快照，旧快照将在每次备份后删除">
                按时间范围
              </Tooltip>
            </Radio.Button>
            <Radio.Button value={"policyKeepAll"}>
              <Tooltip title="所有备份都会被保留。注意：如果快照数量巨大可能导致备份速度变慢">
                不限制
              </Tooltip>
            </Radio.Button>
          </Radio.Group>
        </Row>
        <br />
        <Row>
          <Form.Item>{内容}</Form.Item>
        </Row>
      </Form.Item>
    </>
  );
};