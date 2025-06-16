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
  Card,
  Col,
  Collapse,
  Checkbox,
} from "antd";
import React, { useEffect, useState } from "react";
import { useShowModal } from "../components/ModalManager";
import { MinusCircleOutlined, PlusOutlined } from "@ant-design/icons";
import { formatErrorAlert, useAlertApi } from "../components/Alerts";
import { namePattern, validateForm } from "../lib/formutil";
import { useConfig } from "../components/ConfigProvider";
import { authenticationService, backrestService } from "../api";
import { clone, fromJson, toJson, toJsonString } from "@bufbuild/protobuf";
import {
  AuthSchema,
  ConfigSchema,
  UserSchema,
} from "../../gen/ts/v1/config_pb";

interface FormData {
  auth: {
    users: {
      name: string;
      passwordBcrypt: string;
      needsBcrypt?: boolean;
    }[];
  };
  instance: string;
}

export const SettingsModal = () => {
  let [config, setConfig] = useConfig();
  const showModal = useShowModal();
  const alertsApi = useAlertApi()!;
  const [form] = Form.useForm<FormData>();

  if (!config) {
    return null;
  }

  const handleOk = async () => {
    try {
      // 验证表单
      let formData = await validateForm(form);

      if (formData.auth?.users) {
        for (const user of formData.auth?.users) {
          if (user.needsBcrypt) {
            const hash = await authenticationService.hashPassword({
              value: user.passwordBcrypt,
            });
            user.passwordBcrypt = hash.value;
            delete user.needsBcrypt;
          }
        }
      }

      // 更新配置
      let newConfig = clone(ConfigSchema, config);
      newConfig.auth = fromJson(AuthSchema, formData.auth, {
        ignoreUnknownFields: false,
      });
      newConfig.instance = formData.instance;

      if (!newConfig.auth?.users && !newConfig.auth?.disabled) {
        throw new Error(
          "必须至少配置一个用户或禁用身份验证"
        );
      }

      setConfig(await backrestService.setConfig(newConfig));
      alertsApi.success("设置已更新", 5);
      setTimeout(() => {
        window.location.reload();
      }, 500);
    } catch (e: any) {
      alertsApi.error(formatErrorAlert(e, "操作错误："), 15);
      console.error(e);
    }
  };

  const handleCancel = () => {
    showModal(null);
  };

  const users = config.auth?.users || [];

  return (
    <>
      <Modal
        open={true}
        onCancel={handleCancel}
        title={"设置"}
        width="40vw"
        footer={[
          <Button key="back" onClick={handleCancel}>
            取消
          </Button>,
          <Button key="submit" type="primary" onClick={handleOk}>
            提交
          </Button>,
        ]}
      >
        <Form
          autoComplete="off"
          form={form}
          labelCol={{ span: 6 }}
          wrapperCol={{ span: 16 }}
        >
          {users.length > 0 || config.auth?.disabled ? null : (
            <>
              <strong>Backrest初始设置！</strong>
              <p>
                检测到您尚未配置任何用户，请至少添加一个用户以保护Web界面安全。
              </p>
              <p>
                您可以在后续添加更多用户，如果忘记密码，可以通过编辑配置文件（通常位于$HOME/.backrest/config.json）重置用户
              </p>
            </>
          )}
          <Tooltip title="实例名称将用于标识此backrest安装。请谨慎选择，因为该值一旦设置无法更改。">
            <Form.Item
              hasFeedback
              name="instance"
              label="实例ID"
              required
              initialValue={config.instance || ""}
              rules={[
                { required: true, message: "必须填写实例ID" },
                {
                  pattern: namePattern,
                  message:
                    "实例ID必须为字母数字，允许使用'_-.'作为分隔符",
                },
              ]}
            >
              <Input
                placeholder={
                  "此实例的唯一标识符（例如 my-backrest-server）"
                }
                disabled={!!config.instance}
              />
            </Form.Item>
          </Tooltip>
          <Form.Item
            label="禁用身份验证"
            name={["auth", "disabled"]}
            valuePropName="checked"
            initialValue={config.auth?.disabled || false}
          >
            <Checkbox />
          </Form.Item>
          <Form.Item label="用户管理" required={true}>
            <Form.List
              name={["auth", "users"]}
              initialValue={
                config.auth?.users?.map((u) =>
                  toJson(UserSchema, u, { alwaysEmitImplicit: true })
                ) || []
              }
            >
              {(fields, { add, remove }) => (
                <>
                  {fields.map((field, index) => {
                    return (
                      <Row key={field.key} gutter={16}>
                        <Col span={11}>
                          <Form.Item
                            name={[field.name, "name"]}
                            rules={[
                              { required: true, message: "必须填写用户名" },
                              {
                                pattern: namePattern,
                                message:
                                  "用户名必须为字母数字，允许使用短横线或下划线作为分隔符",
                              },
                            ]}
                          >
                            <Input placeholder="用户名" />
                          </Form.Item>
                        </Col>
                        <Col span={11}>
                          <Form.Item
                            name={[field.name, "passwordBcrypt"]}
                            rules={[
                              {
                                required: true,
                                message: "必须填写密码",
                              },
                            ]}
                          >
                            <Input.Password
                              placeholder="密码"
                              onFocus={() => {
                                form.setFieldValue(
                                  ["auth", "users", index, "needsBcrypt"],
                                  true
                                );
                                form.setFieldValue(
                                  ["auth", "users", index, "passwordBcrypt"],
                                  ""
                                );
                              }}
                            />
                          </Form.Item>
                        </Col>
                        <Col span={2}>
                          <MinusCircleOutlined
                            onClick={() => {
                              remove(field.name);
                            }}
                          />
                        </Col>
                      </Row>
                    );
                  })}
                  <Form.Item>
                    <Button
                      type="dashed"
                      onClick={() => {
                        add();
                      }}
                      block
                    >
                      <PlusOutlined /> 添加用户
                    </Button>
                  </Form.Item>
                </>
              )}
            </Form.List>
          </Form.Item>

          <Form.Item shouldUpdate label="预览">
            {() => (
              <Collapse
                size="small"
                items={[
                  {
                    key: "1",
                    label: "配置的JSON格式",
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