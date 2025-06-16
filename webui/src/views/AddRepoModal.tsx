import {
  Form,
  Modal,
  Input,
  Typography,
  AutoComplete,
  Tooltip,
  Button,
  Row,
  Col,
  Card,
  InputNumber,
  FormInstance,
  Collapse,
  Checkbox,
  Select,
  Space,
} from "antd";
import React, { useEffect, useState } from "react";
import { useShowModal } from "../components/ModalManager";
import {
  CommandPrefix_CPUNiceLevel,
  CommandPrefix_CPUNiceLevelSchema,
  CommandPrefix_IONiceLevel,
  CommandPrefix_IONiceLevelSchema,
  type Repo,
  RepoSchema,
  Schedule_Clock,
} from "../../gen/ts/v1/config_pb";
import { StringValueSchema } from "../../gen/ts/types/value_pb";
import { URIAutocomplete } from "../components/URIAutocomplete";
import { MinusCircleOutlined, PlusOutlined } from "@ant-design/icons";
import { formatErrorAlert, useAlertApi } from "../components/Alerts";
import { namePattern, validateForm } from "../lib/formutil";
import { backrestService } from "../api";
import {
  HooksFormList,
  hooksListTooltipText,
} from "../components/HooksFormList";
import { ConfirmButton, SpinButton } from "../components/SpinButton";
import { useConfig } from "../components/ConfigProvider";
import Cron from "react-js-cron";
import {
  ScheduleDefaultsInfrequent,
  ScheduleFormItem,
} from "../components/ScheduleFormItem";
import { isWindows } from "../state/buildcfg";
import { create, fromJson, JsonValue, toJson } from "@bufbuild/protobuf";

const repoDefaults = create(RepoSchema, {
  prunePolicy: {
    maxUnusedPercent: 10,
    schedule: {
      schedule: {
        case: "cron",
        value: "0 0 1 * *", // 每月1日
      },
      clock: Schedule_Clock.LAST_RUN_TIME,
    },
  },
  checkPolicy: {
    schedule: {
      schedule: {
        case: "cron",
        value: "0 0 1 * *", // 每月1日
      },
      clock: Schedule_Clock.LAST_RUN_TIME,
    },
  },
  commandPrefix: {
    ioNice: CommandPrefix_IONiceLevel.IO_DEFAULT,
    cpuNice: CommandPrefix_CPUNiceLevel.CPU_DEFAULT,
  },
});

export const AddRepoModal = ({ template }: { template: Repo | null }) => {
  const [confirmLoading, setConfirmLoading] = useState(false);
  const showModal = useShowModal();
  const alertsApi = useAlertApi()!;
  const [config, setConfig] = useConfig();
  const [form] = Form.useForm<JsonValue>();

  useEffect(() => {
    const initVal = template
      ? toJson(RepoSchema, template, {
          alwaysEmitImplicit: true,
        })
      : toJson(RepoSchema, repoDefaults, { alwaysEmitImplicit: true });
    form.setFieldsValue(initVal);
  }, [template]);

  if (!config) {
    return null;
  }

  const handleDestroy = async () => {
    setConfirmLoading(true);
    try {
      // 更新配置并提示成功
      setConfig(
        await backrestService.removeRepo(
          create(StringValueSchema, { value: template!.id })
        )
      );
      showModal(null);
      alertsApi.success(
        "已从配置中删除仓库 " +
          template!.id! +
          "，但文件保留。要释放存储空间，请手动删除文件。URI: " +
          template!.uri
      );
    } catch (e: any) {
      alertsApi.error(formatErrorAlert(e, "操作错误："), 15);
    } finally {
      setConfirmLoading(false);
    }
  };

  const handleOk = async () => {
    setConfirmLoading(true);
    try {
      let repoFormData = await validateForm(form);
      const repo = fromJson(RepoSchema, repoFormData, {
        ignoreUnknownFields: false,
      });
      if (template !== null) {
        // 更新仓库流程
        setConfig(await backrestService.addRepo(repo));
        showModal(null);
        alertsApi.success("已更新仓库配置 " + repo.uri);
      } else {
        // 创建新仓库流程
        setConfig(await backrestService.addRepo(repo));
        showModal(null);
        alertsApi.success("已添加仓库 " + repo.uri);
      }
      try {
        // 验证配置有效性
        await backrestService.listSnapshots({ repoId: repo.id });
      } catch (e: any) {
        alertsApi.error(
          formatErrorAlert(e, "获取快照失败："),
          10
        );
      }
    } catch (e: any) {
      alertsApi.error(formatErrorAlert(e, "操作错误："), 10);
    } finally {
      setConfirmLoading(false);
    }
  };

  const handleCancel = () => {
    showModal(null);
  };

  return (
    <>
      <Modal
        open={true}
        onCancel={handleCancel}
        title={template ? "编辑Restic仓库" : "添加Restic仓库"}
        width="60vw"
        footer={[
          <Button loading={confirmLoading} key="back" onClick={handleCancel}>
            取消
          </Button>,
          template != null ? (
            <Tooltip title="从配置中移除仓库但不会删除实际仓库文件">
              <ConfirmButton
                key="delete"
                type="primary"
                danger
                onClickAsync={handleDestroy}
                confirmTitle="确认删除"
              >
                删除
              </ConfirmButton>
            </Tooltip>
          ) : null,
          <SpinButton
            key="check"
            onClickAsync={async () => {
              let repoFormData = await validateForm(form);
              const repo = fromJson(RepoSchema, repoFormData, {
                ignoreUnknownFields: false,
              });
              try {
                const exists = await backrestService.checkRepoExists(repo);
                if (exists.value) {
                  alertsApi.success(
                    "连接成功，检测到已存在的仓库：" +
                      repo.uri,
                    10
                  );
                } else {
                  alertsApi.success(
                    "连接成功，未检测到现有仓库，将初始化新仓库：" +
                      repo.uri,
                    10
                  );
                }
              } catch (e: any) {
                alertsApi.error(formatErrorAlert(e, "检查错误："), 10);
              }
            }}
          >
            测试配置
          </SpinButton>,
          <Button
            key="submit"
            type="primary"
            loading={confirmLoading}
            onClick={handleOk}
          >
            提交
          </Button>,
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
          获取仓库配置说明，或查阅{" "}
          <a href="https://restic.readthedocs.io/"  target="_blank">
            restic文档
          </a>{" "}
          了解仓库详细信息。
        </p>
        <br />
        <Form
          autoComplete="off"
          form={form}
          labelCol={{ span: 4 }}
          wrapperCol={{ span: 18 }}
          disabled={confirmLoading}
        >
          {/* 仓库ID */}
          <Tooltip
            title="用于标识此仓库的唯一ID（例如s3-mybucket）。创建后不可修改"
          >
            <Form.Item<Repo>
              hasFeedback
              name="id"
              label="仓库名称"
              validateTrigger={["onChange", "onBlur"]}
              rules={[
                {
                  required: true,
                  message: "请输入仓库名称",
                },
                {
                  validator: async (_, value) => {
                    if (template) return;
                    if (config?.repos?.find((r) => r.id === value)) {
                      throw new Error();
                    }
                  },
                  message: "该仓库名称已存在",
                },
                {
                  pattern: namePattern,
                  message:
                    "名称必须为字母数字，允许使用短横线或下划线作为分隔符",
                },
              ]}
            >
              <Input
                disabled={!!template}
                placeholder={"repo" + ((config?.repos?.length || 0) + 1)}
              />
            </Form.Item>
          </Tooltip>

          <Form.Item<Repo> name="guid" hidden>
            <Input />
          </Form.Item>

          {/* 仓库URI */}
          <Tooltip
            title={
              <>
                支持的仓库类型：
                <ul>
                  <li>本地文件路径</li>
                  <li>S3 例如 s3:// ...</li>
                  <li>SFTP 例如 sftp:user@host:/repo-path</li>
                  <li>
                    请查阅{" "}
                    <a
                      href="https://restic.readthedocs.io/en/latest/030_preparing_a_new_repo.html#preparing-a-new-repository" 
                      target="_blank"
                    >
                      restic文档
                    </a>{" "}
                    了解更多
                  </li>
                </ul>
              </>
            }
          >
            <Form.Item<Repo>
              hasFeedback
              name="uri"
              label="仓库URI"
              validateTrigger={["onChange", "onBlur"]}
              rules={[
                {
                  required: true,
                  message: "请输入仓库URI",
                },
              ]}
            >
              <URIAutocomplete disabled={!!template} />
            </Form.Item>
          </Tooltip>

          {/* 仓库密码 */}
          <Tooltip
            title={
              <>
                用于加密仓库数据的密码：
                <ul>
                  <li>建议选择128位熵值（20个字符以上）</li>
                  <li>可通过环境变量提供密码（RESTIC_PASSWORD等）</li>
                  <li>点击[生成]按钮创建浏览器加密随机密码</li>
                </ul>
              </>
            }
          >
            <Form.Item label="密码">
              <Row>
                <Col span={16}>
                  <Form.Item<Repo>
                    hasFeedback
                    name="password"
                    validateTrigger={["onChange", "onBlur"]}
                  >
                    <Input disabled={!!template} />
                  </Form.Item>
                </Col>
                <Col
                  span={7}
                  offset={1}
                  style={{ display: "flex", justifyContent: "left" }}
                >
                  <Button
                    type="text"
                    onClick={() => {
                      if (template) return;
                      form.setFieldsValue({
                        password: cryptoRandomPassword(),
                      });
                    }}
                  >
                    [生成]
                  </Button>
                </Col>
              </Row>
            </Form.Item>
          </Tooltip>

          {/* 环境变量 */}
          <Tooltip
            title="传递给restic的环境变量（如S3/B2凭证），支持引用父进程变量 FOO=${MY_FOO_VAR}"
          >
            <Form.Item label="环境变量">
              <Form.List
                name="env"
                rules={[
                  {
                    validator: async (_, envVars) => {
                      return await envVarSetValidator(form, envVars);
                    },
                  },
                ]}
              >
                {(fields, { add, remove }, { errors }) => (
                  <>
                    {fields.map((field, index) => (
                      <Form.Item key={field.key}>
                        <Form.Item
                          {...field}
                          validateTrigger={["onChange", "onBlur"]}
                          rules={[
                            {
                              required: true,
                              whitespace: true,
                              pattern: /^[\w-]+=.*$/,
                              message: "环境变量需符合 KEY=VALUE 格式",
                            },
                          ]}
                          noStyle
                        >
                          <Input
                            placeholder="KEY=VALUE"
                            onBlur={() => form.validateFields()}
                            style={{ width: "90%" }}
                          />
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
                        onClick={() => add("")}
                        style={{ width: "90%" }}
                        icon={<PlusOutlined />}
                      >
                        设置环境变量
                      </Button>
                      <Form.ErrorList errors={errors} />
                    </Form.Item>
                  </>
                )}
              </Form.List>
            </Form.Item>
          </Tooltip>

          {/* 命令标志 */}
          <Form.Item label="命令标志">
            <Form.List name="flags">
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
                            message: "请输入CLI标志参数（参考restic --help）",
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
                      设置标志
                    </Button>
                    <Form.ErrorList errors={errors} />
                  </Form.Item>
                </>
              )}
            </Form.List>
          </Form.Item>

          {/* 清理策略 */}
          <Form.Item
            label={
              <Tooltip
                title={
                  <span>
                    仓库清理操作的时间安排。请查阅{" "}
                    <a
                      href="https://restic.readthedocs.io/en/stable/060_forget.html#customize-pruning" 
                      target="_blank"
                    >
                      restic清理策略文档
                    </a>{" "}
                    了解更多
                  </span>
                }
              >
                清理策略
              </Tooltip>
            }
          >
            <Form.Item
              name={["prunePolicy", "maxUnusedPercent"]}
              initialValue={10}
              required={false}
            >
              <InputPercent
                addonBefore={
                  <Tooltip title="清理后仓库允许的最大未使用百分比。高值减少复制操作但占用更多存储空间">
                    <div style={{ width: "12" }}>清理后最大未使用</div>
                  </Tooltip>
                }
              />
            </Form.Item>
            <ScheduleFormItem
              name={["prunePolicy", "schedule"]}
              defaults={ScheduleDefaultsInfrequent}
            />
          </Form.Item>

          {/* 检查策略 */}
          <Form.Item
            label={
              <Tooltip
                title={
                  <span>
                    仓库检查操作的时间安排。Restic检查操作通过扫描磁盘结构验证备份数据完整性。
                    可选配置重新读取和哈希校验数据（耗时且占用带宽，但能检测存储介质的位错误）
                  </span>
                }
              >
                检查策略
              </Tooltip>
            }
          >
            <Form.Item
              name={["checkPolicy", "readDataSubsetPercent"]}
              initialValue={0}
              required={false}
            >
              <InputPercent
                addonBefore={
                  <Tooltip title="每次检查时读取并验证的仓库数据百分比。100%表示每次完整检查">
                    <div style={{ width: "12" }}>数据读取比例</div>
                  </Tooltip>
                }
              />
            </Form.Item>
            <ScheduleFormItem
              name={["checkPolicy", "schedule"]}
              defaults={ScheduleDefaultsInfrequent}
            />
          </Form.Item>

          {/* 命令修饰符 */}
          {!isWindows && (
            <Form.Item
              label={
                <Tooltip
                  title="备份操作的修饰符，例如设置CPU或IO优先级"
                >
                  命令修饰符
                </Tooltip>
              }
              colon={false}
            >
              <Row>
                <Col span={12} style={{ paddingLeft: "5px" }}>
                  <Tooltip
                    title={
                      <>
                        可用IO优先级模式：
                        <ul>
                          <li>IO_BEST_EFFORT_LOW - 低优先级（优先其他进程）</li>
                          <li>IO_BEST_EFFORT_HIGH - 高优先级（磁盘队列首位）</li>
                          <li>IO_IDLE - 仅在磁盘空闲时运行</li>
                        </ul>
                      </>
                    }
                  >
                    IO优先级：
                    <br />
                    <Form.Item
                      name={["commandPrefix", "ioNice"]}
                      required={false}
                    >
                      <Select
                        allowClear
                        style={{ width: "100%" }}
                        placeholder="选择IO优先级"
                        options={CommandPrefix_IONiceLevelSchema.values.map(
                          (v) => ({
                            label: v.name,
                            value: v.name,
                          })
                        )}
                      />
                    </Form.Item>
                  </Tooltip>
                </Col>
                <Col span={12} style={{ paddingLeft: "5px" }}>
                  <Tooltip
                    title={
                      <>
                        可用CPU优先级模式：
                        <ul>
                          <li>CPU_DEFAULT - 默认优先级</li>
                          <li>CPU_HIGH - 高优先级（需要root权限）</li>
                          <li>CPU_LOW - 低优先级</li>
                        </ul>
                      </>
                    }
                  >
                    CPU优先级：
                    <br />
                    <Form.Item
                      name={["commandPrefix", "cpuNice"]}
                      required={false}
                    >
                      <Select
                        allowClear
                        style={{ width: "100%" }}
                        placeholder="选择CPU优先级"
                        options={CommandPrefix_CPUNiceLevelSchema.values.map(
                          (v) => ({
                            label: v.name,
                            value: v.name,
                          })
                        )}
                      />
                    </Form.Item>
                  </Tooltip>
                </Col>
              </Row>
            </Form.Item>
          )}

          {/* 自动解锁 */}
          <Form.Item
            label={
              <Tooltip
                title="自动解锁会在清理操作开始时移除锁文件。若仓库被多个客户端共享使用，此操作可能不安全。默认禁用"
              >
                自动解锁
              </Tooltip>
            }
            name="autoUnlock"
            valuePropName="checked"
          >
            <Checkbox />
          </Form.Item>

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
                    label: "仓库配置JSON",
                    children: (
                      <Typography>
                        <pre>
                          {JSON.stringify(form.getFieldsValue(), undefined, 2)}
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

// 环境变量验证规则
const expectedEnvVars: { [scheme: string]: string[][] } = {
  s3: [
    ["AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY"],
    ["AWS_SHARED_CREDENTIALS_FILE"],
  ],
  b2: [["B2_ACCOUNT_ID", "B2_ACCOUNT_KEY"]],
  azure: [
    ["AZURE_ACCOUNT_NAME", "AZURE_ACCOUNT_KEY"],
    ["AZURE_ACCOUNT_NAME", "AZURE_ACCOUNT_SAS"],
  ],
  gs: [
    ["GOOGLE_APPLICATION_CREDENTIALS", "GOOGLE_PROJECT_ID"],
    ["GOOGLE_ACCESS_TOKEN"],
  ],
};

// 环境变量验证器
const envVarSetValidator = (form: FormInstance<any>, envVars: string[]) => {
  if (!envVars) return Promise.resolve();

  let uri = form.getFieldValue("uri");
  if (!uri) return Promise.resolve();

  const envVarNames = envVars.map((e) => {
    if (!e) return "";
    let idx = e.indexOf("=");
    return idx === -1 ? "" : e.substring(0, idx);
  });

  // 检查密码是否提供
  const password = form.getFieldValue("password");
  if (
    (!password || password.length === 0) &&
    !envVarNames.includes("RESTIC_PASSWORD") &&
    !envVarNames.includes("RESTIC_PASSWORD_COMMAND") &&
    !envVarNames.includes("RESTIC_PASSWORD_FILE")
  ) {
    return Promise.reject(
      new Error(
        "缺少仓库密码。请提供密码或设置以下环境变量之一：RESTIC_PASSWORD、RESTIC_PASSWORD_COMMAND、RESTIC_PASSWORD_FILE"
      )
    );
  }

  // 检查特定协议的环境变量
  let schemeIdx = uri.indexOf(":");
  if (schemeIdx === -1) return Promise.resolve();
  let scheme = uri.substring(0, schemeIdx);

  return checkSchemeEnvVars(scheme, envVarNames);
};

// 生成随机密码
const cryptoRandomPassword = (): string => {
  let vals = crypto.getRandomValues(new Uint8Array(64));
  return btoa(String.fromCharCode(...vals)).slice(0, 48);
};

// 协议环境变量检查
const checkSchemeEnvVars = (
  scheme: string,
  envVarNames: string[]
): Promise<void> => {
  let expected = expectedEnvVars[scheme];
  if (!expected) return Promise.resolve();

  const missingVarsCollection: string[][] = [];
  for (let possibility of expected) {
    const missingVars = possibility.filter(
      (envVar) => !envVarNames.includes(envVar)
    );
    if (missingVars.length === 0) return Promise.resolve();
    if (missingVars.length < possibility.length) {
      missingVarsCollection.push(missingVars);
    }
  }

  if (!missingVarsCollection.length) {
    missingVarsCollection.push(...expected);
  }

  return Promise.reject(
    new Error(
      "缺少环境变量 " +
        formatMissingEnvVars(missingVarsCollection) +
        " 用于协议 " +
        scheme
    )
  );
};

// 格式化缺失变量提示
const formatMissingEnvVars = (partialMatches: string[][]): string => {
  return partialMatches
    .map((x) => {
      if (x.length > 1) {
        return `[ ${x.join(", ")} ]`;
      }
      return x[0];
    })
    .join(" 或 ");
};

// 百分比输入组件
const InputPercent = ({ ...props }) => {
  return (
    <InputNumber
      step={1}
      min={0}
      max={100}
      precision={2}
      controls={false}
      suffix="%"
      {...props}
    />
  );
};